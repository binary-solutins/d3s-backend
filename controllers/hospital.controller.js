const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const Hospital = db.Hospital;
const sendEmail = require('../utils/emainSender');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { BlobServiceClient } = require('@azure/storage-blob');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // limit to 5MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
}).single('image');

// Middleware for handling file upload
exports.handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Initialize Azure Blob Service Client
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerName = 'hospital-images';

// Helper function to upload image to Azure Blob Storage
const uploadToAzureBlob = async (file) => {
  try {
    // Check if buffer exists and has content
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty or missing');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob'
    });

    // Generate unique blob name
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileExtension = path.extname(file.originalname);
    const blobName = `hospital/${timestamp}/${fileId}${fileExtension}`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload options
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
        blobCacheControl: 'public, max-age=31536000',
        blobContentDisposition: `inline; filename="${file.originalname}"`
      },
      metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
        originalSize: file.size.toString()
      }
    };

    // Upload file buffer to blob
    await blockBlobClient.upload(
      file.buffer, 
      file.buffer.length,
      uploadOptions
    );

    // Return the file URL
    return blockBlobClient.url;
  } catch (error) {
    console.error('Azure Blob upload error:', error);
    throw new Error(`Failed to upload image to Azure Blob Storage: ${error.message}`);
  }
};

// 🏥 Signup Hospital
exports.signup = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let imageUrl = null;
    // Check if file was uploaded
    if (req.file) {
      // Upload to Azure Blob Storage
      imageUrl = await uploadToAzureBlob(req.file);
    }

    const hospital = await Hospital.create({
      name,
      email,
      password: hashedPassword,
      otp,
      imageUrl,
      phone
    });

    await sendEmail(email, '📧 Verify Your Email', `Your OTP is: ${otp}`);
    res.status(201).json({ 
      message: '✅ OTP sent to email',
      hospitalId: hospital.id
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const hospital = await Hospital.findOne({ where: { email } });

    if (!hospital) return res.status(404).json({ error: '❌ Hospital not found' });
    if (hospital.otp !== otp) return res.status(400).json({ error: '❌ Invalid OTP' });

    await hospital.update({ isVerified: true, otp: null });
    res.status(200).json({ message: '✅ Email verified successfully' });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔐 Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const hospital = await Hospital.findOne({ where: { email } });

    if (!hospital || !(await bcrypt.compare(password, hospital.password))) {
      return res.status(401).json({ error: '❌ Invalid credentials' });
    }

    if (!hospital.isVerified) {
      return res.status(401).json({ error: '❌ Email not verified by the admin.' });
    }

    if (hospital.plan_time && new Date() > hospital.plan_time) {
      await hospital.update({ isVerified: false });
      return res.status(401).json({ error: '❌ Subscription expired' });
    }

    const token = jwt.sign({ id: hospital.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ 
      token, 
      message: '✅ Login successful',
      hospital: {
        id: hospital.id,
        name: hospital.name,
        email: hospital.email,
        phone: hospital.phone,
        imageUrl: hospital.imageUrl
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔄 Update Hospital Details
exports.updateHospital = async (req, res) => {
  try {
    console.log('Update hospital request received', { 
      body: req.body,
      file: req.file ? true : false,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });
    
    const hospitalId = req.params.id || req.hospitalId; // Get from params or auth middleware
    const { name, email, phone, country, state, city, address } = req.body;
    
    const hospital = await Hospital.findByPk(hospitalId);
    
    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }
    
    let imageUrl = hospital.imageUrl;
    // Check if file was uploaded
    if (req.file) {
      try {
        // Upload to Azure Blob Storage
        imageUrl = await uploadToAzureBlob(req.file);
        console.log('Image uploaded successfully', { imageUrl });
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        // Continue with update without changing the image
        return res.status(400).json({ 
          error: 'Image upload failed. Please try again with a different image.',
          details: uploadError.message
        });
      }
    }
    
    await hospital.update({
      name: name || hospital.name,
      email: email || hospital.email,
      phone: phone || hospital.phone,
      country: country || hospital.country,
      state: state || hospital.state,
      city: city || hospital.city,
      address: address || hospital.address,
      imageUrl: imageUrl
    });
    
    res.status(200).json({
      message: '✅ Hospital details updated successfully',
      hospital: {
        id: hospital.id,
        name: hospital.name,
        email: hospital.email,
        phone: hospital.phone,
        country: hospital.country,
        state: hospital.state,
        city: hospital.city,
        address: hospital.address,
        imageUrl: hospital.imageUrl
      }
    });
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ error: error.message });
  }
};