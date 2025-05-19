const multer = require('multer');
const path = require('path');
const db = require('../models');
const Report = db.Report;
const Patient = db.Patient;
const Doctor = db.Doctor;
const Hospital= db.Hospital
const { generateBreastCancerReport } = require('../utils/reportUtils');
const { Op } = require('sequelize');
const https = require('https');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

// Configure multer for memory storage
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
});

// Helper function to upload file to Appwrite
const uploadToAppwrite = async (file, patientId, fileType) => {
  try {
    // Check if buffer exists and has content
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty or missing');
    }

    const form = new FormData();
    const fileId = uuidv4();

    form.append('fileId', fileId);
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const BUCKET_ID = process.env.APPWRITE_BUCKET_ID;
    const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
    const API_KEY = process.env.APPWRITE_API_KEY;

    const response = await axios.post(
      `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'X-Appwrite-Project': PROJECT_ID,
          'X-Appwrite-Key': API_KEY,
        },
      }
    );

    // Construct the file URL
    const fileUrl = `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${PROJECT_ID}`;

    return {
      fileId: fileId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      fileUrl: fileUrl,
      fieldName: fileType
    };
  } catch (error) {
    console.error('Appwrite upload error:', error);
    throw new Error(`Failed to upload file to Appwrite: ${error.message}`);
  }
};

// Helper function to delete file from Appwrite
const deleteFromAppwrite = async (fileUrl) => {
  try {
    // Extract fileId from URL
    const urlParts = fileUrl.split('/');
    const fileId = urlParts[urlParts.length - 2];
    
    const BUCKET_ID = process.env.APPWRITE_BUCKET_ID;
    const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
    const API_KEY = process.env.APPWRITE_API_KEY;

    await axios.delete(
      `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${fileId}`,
      {
        headers: {
          'X-Appwrite-Project': PROJECT_ID,
          'X-Appwrite-Key': API_KEY,
        },
      }
    );

    return true;
  } catch (error) {
    console.error('Appwrite delete error:', error);
    throw new Error(`Failed to delete file from Appwrite: ${error.message}`);
  }
};

// Updated middleware for handling multiple file uploads (for breast cancer reports)
exports.uploadBreastCancerImagesMiddleware = (req, res, next) => {
  const breastImagesUpload = upload.fields([
    { name: 'leftTopImage', maxCount: 1 },
    { name: 'leftCenterImage', maxCount: 1 },
    { name: 'leftBottomImage', maxCount: 1 },
    { name: 'rightTopImage', maxCount: 1 },
    { name: 'rightCenterImage', maxCount: 1 },
    { name: 'rightBottomImage', maxCount: 1 }
  ]);

  breastImagesUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Middleware for handling single file upload
exports.uploadReportFileMiddleware = (req, res, next) => {
  const singleFileUpload = upload.single('reportFile');
  
  singleFileUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Create a breast cancer report with 6 images
// Create a breast cancer report with 6 images
exports.createBreastCancerReport = async (req, res) => {
  try {
    const { patientId, doctorId, hospitalId, title, description } = req.body;
    
    // Validate inputs
    if (!patientId || !doctorId || !hospitalId) {
      return res.status(400).json({ error: '❌ Patient ID, Doctor ID, and Hospital ID are required' });
    }

    // Check if all 6 required images are uploaded
    const requiredImageFields = [
      'leftTopImage', 'leftCenterImage', 'leftBottomImage',
      'rightTopImage', 'rightCenterImage', 'rightBottomImage'
    ];
    
    const missingImages = requiredImageFields.filter(field => !req.files || !req.files[field]);
    
    if (missingImages.length > 0) {
      return res.status(400).json({ 
        error: `❌ Missing required breast images: ${missingImages.join(', ')}` 
      });
    }

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

    // Validate doctor exists
    const doctor = await Doctor.findOne({
      where: {
        id: doctorId,
        hospitalId
      }
    });

    // Get hospital data with imageUrl
    const hospital = await Hospital.findOne({
      where: {
        id: hospitalId,
      },
      attributes: ['id', 'name', 'address', 'imageUrl'] // Explicitly include imageUrl
    });

    if (!doctor) {
      return res.status(404).json({ error: '❌ Doctor not found or not associated with this hospital' });
    }

    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }

    // Upload all images to Appwrite
    const uploadPromises = [];
    
    for (const fieldName of requiredImageFields) {
      uploadPromises.push(
        uploadToAppwrite(req.files[fieldName][0], patientId, fieldName)
      );
    }

    const uploadedImages = await Promise.all(uploadPromises);
    
    // Generate PDF report from the uploaded images
    const pdfReportData = await generateBreastCancerReport(
      uploadedImages, 
      patient, 
      doctor, 
      hospital, // Now includes the imageUrl property
      title || 'Breast Cancer Screening Report'
    );

    console.log("✅ Fetched Entities:", {
      patient,
      doctor,
      hospital
    });

    const currentDate = new Date();
const formattedDate = currentDate.toISOString().replace(/[:.]/g, '-');
    // Upload the generated PDF to Appwrite
    const pdfFile = {
      buffer: pdfReportData,
      mimetype: 'application/pdf',
      originalname: `${patient.lastName}_${patient.firstName}_${formattedDate}.pdf`,
      size: pdfReportData.length
    };


    
    const pdfUploadData = await uploadToAppwrite(pdfFile, patientId, 'generated_pdf_report');

    // Create report record in database
    const report = await Report.create({
      title: title || 'Breast Cancer Screening Report',
      description: description || 'Breast cancer screening report with 6 images',
      reportType: 'Other', // Fixed: proper report type
      patientId,
      doctorId,
      hospitalId,
      uploadedBy: req.userId || hospitalId,
      fileUrl: pdfUploadData.fileUrl,
      fileName: pdfUploadData.fileName,
      fileType: pdfUploadData.fileType,
      fileSize: pdfUploadData.fileSize || pdfReportData.length, // Ensure fileSize is not null
      metadata: {
        images: uploadedImages.map(img => ({
          position: img.fieldName,
          fileUrl: img.fileUrl
        })),
        generatedAt: new Date().toISOString(),
        generatedBy: doctorId
      }
    });
    
    res.status(201).json({
      message: '✅ Breast cancer report generated and uploaded successfully',
      report: {
        id: report.id,
        title: report.title,
        reportType: 'Other',
        patientId: report.patientId,
        doctorId: report.doctorId,
        fileName: report.fileName,
        fileUrl: report.fileUrl,
        uploadedAt: report.uploadedAt
      }
    });
  } catch (error) {
    console.error("Error in createBreastCancerReport:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new report
exports.createReport = async (req, res) => {
  try {
    let { patientId, doctorId, title, description, reportType, hospitalId } = req.body;

    // If hospitalId or patientId is not in the body, try to get it from the request
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

    // Validate doctor exists if provided
    if (doctorId) {
      const doctor = await Doctor.findOne({
        where: {
          id: doctorId,
          hospitalId
        }
      });

      if (!doctor) {
        return res.status(404).json({ error: '❌ Doctor not found or not associated with this hospital' });
      }
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: '❌ No report file uploaded' });
    }
    
    // Upload file to Appwrite
    const fileData = await uploadToAppwrite(req.file, patientId, 'general_report');
    
    // Create report record in database
    const report = await Report.create({
      title,
      description,
      reportType: 'Brease Cancer Report',
      patientId,
      doctorId,
      hospitalId,
      uploadedBy: req.userId || hospitalId,
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
        doctorId: report.doctorId,
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
    

   
    patientId = patientId || req.body.patientId;
    
    // Validate patient exists and belongs to this hospital
    const patient = await Patient.findOne({ 
      where: { 
        id: patientId,
      }
    });
    
    if (!patient) {
      return res.status(404).json({ error: '❌ Patient not found or not associated with this hospital' });
    }
    
    const reports = await Report.findAll({
      where: {
        patientId,
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
        },
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'specialization']
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

exports.getReportsByHospitalId = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Validate hospital exists
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }

    const { count, rows: reports } = await Report.findAndCountAll({
      where: {
        hospitalId,
        isDeleted: false
      },
      attributes: [
        'id', 'title', 'reportType', 'patientId',
        'fileName', 'fileUrl', 'uploadedAt'
      ],
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['firstName', 'lastName']
        },
      
      ],
      order: [['uploadedAt', 'DESC']],
      limit: pageSize,
      offset: offset
    });

    if (count === 0) {
      return res.status(404).json({ message: '❌ No reports found for this hospital' });
    }

    res.status(200).json({
      totalItems: count,
      totalPages: Math.ceil(count / pageSize),
      currentPage: page,
      pageSize: pageSize,
      reports: reports.map(report => ({
        ...report.get({ plain: true }),
        patientName: `${report.patient.firstName} ${report.patient.lastName}`,
       
      }))
    });
  } catch (error) {
    console.error('Error fetching hospital reports:', error);
    res.status(500).json({ error: error.message });
  }
};

// Download a report (proxy the file from Appwrite)
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
    
    // Stream the file from Appwrite to the response
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
    const { title, description, reportType, doctorId } = req.body;
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

    // If doctorId is provided, validate doctor exists
    if (doctorId) {
      const doctor = await Doctor.findOne({
        where: {
          id: doctorId,
          hospitalId
        }
      });

      if (!doctor) {
        return res.status(404).json({ error: '❌ Doctor not found or not associated with this hospital' });
      }
    }
    
    await report.update({
      title: title || report.title,
      description: description || report.description,
      reportType: reportType || report.reportType,
      doctorId: doctorId || report.doctorId
    });
    
    res.status(200).json({
      message: '✅ Report details updated successfully',
      report: {
        id: report.id,
        title: report.title,
        description: report.description,
        reportType: report.reportType,
        doctorId: report.doctorId
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
    
    // Delete file from Appwrite
    await deleteFromAppwrite(report.fileUrl);
    
    // If this is a breast cancer report, also delete the source images
    if (report.reportType === 'Breast Cancer' && report.metadata && report.metadata.images) {
      const imageDeletePromises = report.metadata.images.map(image => 
        deleteFromAppwrite(image.fileUrl)
      );
      await Promise.all(imageDeletePromises);
    }
    
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
    const { patientId, doctorId, reportType, startDate, endDate, query } = req.query;
    let hospitalId = req.hospitalId; // From auth middleware
    hospitalId = hospitalId || req.body.hospitalId;
    
    const whereClause = {
      hospitalId,
      isDeleted: false
    };
    
    // Add filters to the where clause
    if (patientId) whereClause.patientId = patientId;
    if (doctorId) whereClause.doctorId = doctorId;
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
        },
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'firstName', 'lastName', 'specialization']
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