const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const Hospital = db.Hospital;
const sendEmail = require('../utils/emainSender');
const multer = require('multer');
const path = require('path');
const { uploadImage } = require('../utils/googleCloud');

// Configure multer for memory storage (needed for GCS upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
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
exports.uploadHospitalImage = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// 🏥 Signup Hospital
exports.signup = async (req, res) => {
  try {
    const { name, email, password,phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let imageUrl = null;
    // Check if file was uploaded
    if (req.file) {
      // Upload to Google Cloud Storage
      imageUrl = await uploadImage(req.file);
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
    res.status(500).json({ error: error.message });
  }
};

// 🔄 Update Hospital Details
exports.updateHospital = async (req, res) => {
  try {
    const hospitalId = req.params.id || req.hospitalId; // Get from params or auth middleware
    const { name, email, phone, country, state, city, address } = req.body;
    
    const hospital = await Hospital.findByPk(hospitalId);
    
    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }
    
    let imageUrl = hospital.imageUrl;
    // Check if file was uploaded
    if (req.file) {
      // Upload to Google Cloud Storage
      imageUrl = await uploadImage(req.file);
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
    res.status(500).json({ error: error.message });
  }
};