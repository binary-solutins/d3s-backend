const multer = require('multer');
const path = require('path');
const db = require('../models');
const Report = db.Report;
const Patient = db.Patient;
const { uploadReportFile, deleteReportFile } = require('../utils/reportUtils');
const { Op } = require('sequelize');
const https = require('https');

// Configure multer for memory storage (needed for GCS upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // limit to 15MB
  },
  fileFilter: (req, file, cb) => {
    // Allow common document and image file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|dicom/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only document and image files are allowed!'));
  }
}).single('reportFile');

// Middleware for handling file upload
exports.uploadReportFileMiddleware = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Create a new report
exports.createReport = async (req, res) => {
    try {
      let { patientId, title, description, reportType, hospitalId } = req.body;

      //If hospitalId or patientId is not in the body, try to get it from the request
      hospitalId = hospitalId || req.hospitalId;
      patientId = patientId || req.patientId;
     
      
      // Validate patient exists and belongs to this hospital
      const patient = await Patient.findOne({ 
        where: { 
          id: patientId,
          hospitalId
        }
      });
      
      if (!patient) {
        return res.status(404).json({ error: '❌ Patient not found or not associated with this hospital' });
      }
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: '❌ No report file uploaded' });
      }
      
      // Upload file to Google Cloud Storage
      const fileData = await uploadReportFile(req.file, patientId);
      
      // Create report record in database
      const report = await Report.create({
        title,
        description,
        reportType,
        patientId,
        hospitalId,
        uploadedBy: req.userId || hospitalId, // Depends on your auth system
        fileUrl: fileData.fileUrl,
        fileName: fileData.fileName,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize
      });
      
      res.status(201).json({
        message: '✅ Report uploaded successfully',
        report: {
          id: report.id,
          title: report.title,
          reportType: report.reportType,
          patientId: report.patientId,
          fileName: report.fileName,
          uploadedAt: report.uploadedAt
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

// Get all reports for a patient
exports.getPatientReports = async (req, res) => {
  try {
    let { patientId } = req.params;
    let hospitalId = req.hospitalId; // From auth middleware

    hospitalId = hospitalId || req.body.hospitalId;
    patientId = patientId || req.body.patientId;
    
    // Validate patient exists and belongs to this hospital
    const patient = await Patient.findOne({ 
      where: { 
        id: patientId,
        hospitalId
      }
    });
    
    if (!patient) {
      return res.status(404).json({ error: '❌ Patient not found or not associated with this hospital' });
    }
    
    const reports = await Report.findAll({
      where: {
        patientId,
        hospitalId,
        isDeleted: false
      },
      attributes: [
        'id', 'title', 'description', 'reportType', 
        'fileName', 'fileType', 'fileSize', 'fileUrl',
        'uploadedAt', 'uploadedBy'
      ],
      order: [['uploadedAt', 'DESC']]
    });
    
    res.status(200).json({
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName
      },
      reports
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a specific report by ID
exports.getReportById = async (req, res) => {
  try {
    const { reportId } = req.params; 
    const report = await Report.findOne({
      where: {
        id: reportId,
        isDeleted: false
      },
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'gender', 'age']
        }
      ]
    });
    
    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }
    
    res.status(200).json({ report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Download a report (proxy the file from Google Cloud Storage)
exports.downloadReport = async (req, res) => {
  try {
    const { reportId } = req.params;  
    const report = await Report.findOne({
      where: {
        id: reportId,
        isDeleted: false
      }
    });
    
    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }
    
    // Set response headers for download
    res.setHeader('Content-Disposition', `attachment; filename=${report.fileName}`);
    res.setHeader('Content-Type', report.fileType);
    
    // Stream the file from GCS to the response
    https.get(report.fileUrl, (fileStream) => {
      fileStream.pipe(res);
    }).on('error', (err) => {
      res.status(500).json({ error: `❌ Error downloading file: ${err.message}` });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update report details (not the file itself)
exports.updateReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { title, description, reportType } = req.body;
    let hospitalId = req.hospitalId; // From auth middleware
    hospitalId = hospitalId || req.body.hospitalId;
    
    const report = await Report.findOne({
      where: {
        id: reportId,
        hospitalId,
        isDeleted: false
      }
    });
    
    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }
    
    await report.update({
      title: title || report.title,
      description: description || report.description,
      reportType: reportType || report.reportType
    });
    
    res.status(200).json({
      message: '✅ Report details updated successfully',
      report: {
        id: report.id,
        title: report.title,
        description: report.description,
        reportType: report.reportType
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Soft delete a report
exports.deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findOne({
      where: {
        id: reportId,
        isDeleted: false
      }
    });
    
    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }
    
    // Soft delete the report
    await report.update({ isDeleted: true });
    
    res.status(200).json({ message: '✅ Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Hard delete a report (including file from storage)
exports.permanentDeleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    let hospitalId = req.hospitalId; // From auth middleware
    hospitalId = hospitalId || req.body.hospitalId;
    
    const report = await Report.findOne({
      where: {
        id: reportId,
        hospitalId
      }
    });
    
    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }
    
    // Delete file from Google Cloud Storage
    await deleteReportFile(report.fileUrl);
    
    // Delete record from database
    await report.destroy();
    
    res.status(200).json({ message: '✅ Report permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Search reports
exports.searchReports = async (req, res) => {
  try {
    const { patientId, reportType, startDate, endDate, query } = req.query;
    let hospitalId = req.hospitalId; // From auth middleware
    hospitalId = hospitalId || req.body.hospitalId;
    
    const whereClause = {
      hospitalId,
      isDeleted: false
    };
    
    // Add filters to the where clause
    if (patientId) whereClause.patientId = patientId;
    if (reportType) whereClause.reportType = reportType;
    
    // Date range filter
    if (startDate || endDate) {
      whereClause.uploadedAt = {};
      if (startDate) whereClause.uploadedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.uploadedAt[Op.lte] = new Date(endDate);
    }
    
    // Text search filter
    if (query) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${query}%` } },
        { description: { [Op.like]: `%${query}%` } },
        { fileName: { [Op.like]: `%${query}%` } }
      ];
    }
    
    const reports = await Report.findAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      order: [['uploadedAt', 'DESC']]
    });
    
    res.status(200).json({
      count: reports.length,
      reports
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};