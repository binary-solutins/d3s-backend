const db = require('../models');
const Doctor = db.Doctor;
const Patient = db.Patient;
const Report = db.Report;
const Hospital = db.Hospital;
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { BlobServiceClient } = require('@azure/storage-blob');

// Initialize Azure Blob Service Client
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerName = 'reports';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      return cb(null, true);
    }
    cb(new Error('Only PDF files are allowed!'));
  }
});

// Helper function to upload file to Azure Blob Storage
const uploadToAzureBlob = async (file, patientId, fileType) => {
  try {
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty or missing');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    await containerClient.createIfNotExists({
      access: 'blob'
    });

    const fileId = uuidv4();
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileExtension = path.extname(file.originalname);
    const blobName = `${patientId}/${fileType}/${timestamp}/${fileId}${fileExtension}`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
        blobCacheControl: 'public, max-age=31536000',
        blobContentDisposition: `inline; filename="${file.originalname}"`
      },
      metadata: {
        originalName: file.originalname,
        patientId: patientId.toString(),
        fileType: fileType,
        uploadedAt: new Date().toISOString(),
        originalSize: file.size.toString()
      },
      tier: 'Hot'
    };

    await blockBlobClient.upload(
      file.buffer, 
      file.buffer.length,
      uploadOptions
    );

    return {
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      fileUrl: blockBlobClient.url
    };
  } catch (error) {
    console.error('Azure Blob upload error:', error);
    throw new Error(`Failed to upload file to Azure Blob Storage: ${error.message}`);
  }
};

// Middleware for handling PDF upload
exports.uploadPdfMiddleware = (req, res, next) => {
  const singleFileUpload = upload.single('pdf');
  
  singleFileUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// POST /api/offline/doctors
exports.syncDoctor = async (req, res) => {
  try {
    const { name, specialization, designation, experience, hospitalId, mobile } = req.body;

    // Validate required fields
    if (!name || !specialization || !hospitalId) {
      return res.status(400).json({ 
        message: 'Missing required fields: name, specialization, and hospitalId are required' 
      });
    }

    // Validate hospital exists
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(400).json({ message: 'Hospital not found' });
    }

    // Create doctor (only include fields that exist in the model)
    const doctor = await Doctor.create({
      name,
      specialization,
      designation: designation || null,
      hospitalId,
      isActive: true
      // Note: experience and mobile fields are not in the current Doctor model schema
      // If needed, add them to the model first
    });

    res.status(200).json({ doctorId: doctor.id });
  } catch (error) {
    console.error('Error syncing doctor:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

// POST /api/offline/patients
exports.syncPatient = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      age, 
      contact, 
      gender, 
      hospitalId, 
      weight, 
      height, 
      address, 
      adharNumber, 
      email,
      familyHistoryOfCancer,
      breastLump,
      breastPain,
      changeInBreastAppearance,
      breastSkinChanges,
      nippleDischarge,
      nippleSymptoms,
      previousBreastScreening,
      previousBreastProceduresOrAbnormalReport
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !age || !contact || !gender || !hospitalId) {
      return res.status(400).json({ 
        message: 'Missing required fields: firstName, lastName, age, contact, gender, and hospitalId are required' 
      });
    }

    // Validate gender enum
    const validGenders = ['Male', 'Female', 'Other'];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({ 
        message: `Invalid gender. Must be one of: ${validGenders.join(', ')}` 
      });
    }

    // Validate hospital exists
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(400).json({ message: 'Hospital not found' });
    }

    // Create patient
    const patient = await Patient.create({
      firstName,
      lastName,
      age,
      contact,
      gender,
      hospitalId,
      weight: weight || null,
      height: height || null,
      address: address || null,
      adharNumber: adharNumber || null,
      email: email || null,
      familyHistoryOfCancer: familyHistoryOfCancer ?? null,
      breastLump: breastLump ?? null,
      breastPain: breastPain ?? null,
      changeInBreastAppearance: changeInBreastAppearance ?? null,
      breastSkinChanges: breastSkinChanges ?? null,
      nippleDischarge: nippleDischarge ?? null,
      nippleSymptoms: nippleSymptoms ?? null,
      previousBreastScreening: previousBreastScreening ?? null,
      previousBreastProceduresOrAbnormalReport: previousBreastProceduresOrAbnormalReport ?? null,
      isDeleted: false
    });

    res.status(200).json({ patientId: patient.id });
  } catch (error) {
    console.error('Error syncing patient:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

// POST /api/offline/reports
exports.syncReport = async (req, res) => {
  try {
    const { doctorId, patientId, hospitalId, title, description, reportType, notes, createdAt } = req.body;

    // Validate required fields
    if (!doctorId || !patientId || !hospitalId || !title) {
      return res.status(400).json({ 
        message: 'Missing required fields: doctorId, patientId, hospitalId, and title are required' 
      });
    }

    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'PDF file is required' });
    }

    // Validate doctor exists
    const doctor = await Doctor.findOne({
      where: { id: doctorId, hospitalId, isActive: true }
    });
    if (!doctor) {
      return res.status(400).json({ message: 'Doctor not found or not active in this hospital' });
    }

    // Validate patient exists
    const patient = await Patient.findOne({
      where: { id: patientId, hospitalId, isDeleted: false }
    });
    if (!patient) {
      return res.status(400).json({ message: 'Patient not found or not associated with this hospital' });
    }

    // Validate hospital exists
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(400).json({ message: 'Hospital not found' });
    }

    // Validate reportType enum
    const validReportTypes = ['Laboratory', 'Radiology', 'Surgical', 'Pathology', 'Other'];
    const finalReportType = reportType && validReportTypes.includes(reportType) 
      ? reportType 
      : 'Other';

    // Upload file to Azure Blob Storage
    const fileData = await uploadToAzureBlob(req.file, patientId, 'offline_sync_report');

    // Determine uploadedAt - use createdAt from request if provided, otherwise use current time
    const uploadedAt = createdAt ? new Date(createdAt) : new Date();

    // Create report
    const report = await Report.create({
      title,
      description: description || null,
      reportType: finalReportType,
      fileUrl: fileData.fileUrl,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize,
      patientId,
      hospitalId,
      doctorId,
      uploadedBy: doctorId, // Use doctorId as uploadedBy for offline sync
      uploadedAt: uploadedAt,
      status: 'pending',
      isDeleted: false,
      isChecked: false,
      remarks: notes || null
    });

    res.status(200).json({ 
      reportId: report.id, 
      fileUrl: report.fileUrl 
    });
  } catch (error) {
    console.error('Error syncing report:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

