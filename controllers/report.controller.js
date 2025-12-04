const multer = require('multer');
const path = require('path');
const db = require('../models');
const Report = db.Report;
const Patient = db.Patient;
const Doctor = db.Doctor;
const Hospital = db.Hospital;
const { generateBreastCancerReport } = require('../utils/reportUtils');
const { Op } = require('sequelize');
const https = require('https');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const axios = require('axios');

// Azure Blob Storage imports
const { BlobServiceClient } = require('@azure/storage-blob');

// Initialize Azure Blob Service Client
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerName = 'reports';

// Configure multer for memory storage with high-quality settings
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Increased to 50MB for high-quality images
  },
  fileFilter: (req, file, cb) => {
    // Allow common document and image file types with focus on high-quality formats
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|dicom|tiff|tif|bmp|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only document and image files are allowed!'));
  }
});

// Helper function to upload file to Azure Blob Storage with high-quality preservation
const uploadToAzureBlob = async (file, patientId, fileType) => {
  try {
    // Check if buffer exists and has content
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty or missing');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob' // Allow public read access to blobs
    });

    // Generate unique blob name with timestamp for better organization
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const fileExtension = path.extname(file.originalname);
    const blobName = `${patientId}/${fileType}/${timestamp}/${fileId}${fileExtension}`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload options for high-quality preservation
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
        blobCacheControl: 'public, max-age=31536000',
        blobContentEncoding: undefined, // Don't compress images
        blobContentLanguage: undefined,
        blobContentDisposition: `inline; filename="${file.originalname}"`
      },
      metadata: {
        originalName: file.originalname,
        patientId: patientId.toString(),
        fileType: fileType,
        uploadedAt: new Date().toISOString(),
        originalSize: file.size.toString(),
        preserveQuality: 'true',
        highQuality: 'true',        // New flag
        compressionLevel: 'none'    // New flag
      },
      tier: 'Hot',
      conditions: {},
      // Add these options for better quality
      blockSize: 4 * 1024 * 1024,  // 4MB blocks for better performance
      concurrency: 5,
      onProgress: (ev) => {
        console.log(`Upload progress: ${ev.loadedBytes}/${file.size} bytes`);
      }
    };

    // Upload file buffer to blob with high-quality settings
    const uploadResponse = await blockBlobClient.upload(
      file.buffer, 
      file.buffer.length,
      uploadOptions
    );

    // Construct the file URL
    const fileUrl = blockBlobClient.url;

    console.log(`✅ High-quality file uploaded: ${file.originalname} (${file.size} bytes)`);

    return {
      fileId: fileId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      fileUrl: fileUrl,
      fieldName: fileType,
      blobName: blobName,
      etag: uploadResponse.etag,
      qualityPreserved: true
    };
  } catch (error) {
    console.error('Azure Blob upload error:', error);
    throw new Error(`Failed to upload file to Azure Blob Storage: ${error.message}`);
  }
};

// Helper function to delete file from Azure Blob Storage
const deleteFromAzureBlob = async (fileUrl) => {
  try {
    // Extract blob name from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    // Remove the first empty element and container name
    pathParts.shift(); // Remove empty string
    pathParts.shift(); // Remove container name
    const blobName = pathParts.join('/');
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete({
      deleteSnapshots: 'include'
    });

    return true;
  } catch (error) {
    console.error('Azure Blob delete error:', error);
    throw new Error(`Failed to delete file from Azure Blob Storage: ${error.message}`);
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
exports.createBreastCancerReport = async (req, res) => {
  try {
    const { patientId, doctorId, hospitalId, title, description } = req.body;
    console.log('DEBUG: createBreastCancerReport - Incoming request body:', { patientId, doctorId, hospitalId, title, description });
    console.log('DEBUG: createBreastCancerReport - Received files:', req.files ? Object.keys(req.files) : 'No files');

    // Validate inputs
    if (!patientId || !doctorId || !hospitalId) {
      console.log('DEBUG: createBreastCancerReport - Validation failed: Missing patientId, doctorId, or hospitalId.');
      return res.status(400).json({ error: '❌ Patient ID, Doctor ID, and Hospital ID are required' });
    }

    // Check if all 6 required images are uploaded
    const requiredImageFields = [
      'leftTopImage', 'leftCenterImage', 'leftBottomImage',
      'rightTopImage', 'rightCenterImage', 'rightBottomImage'
    ];
    
    const missingImages = requiredImageFields.filter(field => !req.files || !req.files[field]);
    
    if (missingImages.length > 0) {
      console.log(`DEBUG: createBreastCancerReport - Validation failed: Missing required breast images: ${missingImages.join(', ')}`);
      return res.status(400).json({ 
        error: `❌ Missing required breast images: ${missingImages.join(', ')}` 
      });
    }
    console.log('DEBUG: createBreastCancerReport - All required images present.');

    // Validate patient exists and belongs to this hospital
    console.log(`DEBUG: createBreastCancerReport - Searching for patient with ID: ${patientId} in hospital: ${hospitalId}`);
    const patient = await Patient.findOne({ 
      where: { 
        id: patientId,
        hospitalId
      }
    });
    
    if (!patient) {
      console.log('DEBUG: createBreastCancerReport - Patient not found or not associated with hospital.');
      return res.status(404).json({ error: '❌ Patient not found or not associated with this hospital' });
    }
    console.log('DEBUG: createBreastCancerReport - Patient found:', patient.id);

    // Validate doctor exists
    console.log(`DEBUG: createBreastCancerReport - Searching for doctor with ID: ${doctorId} in hospital: ${hospitalId}`);
    const doctor = await Doctor.findOne({
      where: {
        id: doctorId,
        hospitalId
      }
    });

    // Get hospital data with imageUrl
    console.log(`DEBUG: createBreastCancerReport - Searching for hospital with ID: ${hospitalId}`);
    const hospital = await Hospital.findOne({
      where: {
        id: hospitalId,
      },
      attributes: ['id', 'name', 'address', 'imageUrl'] 
    });

    if (!doctor) {
      console.log('DEBUG: createBreastCancerReport - Doctor not found or not associated with hospital.');
      return res.status(404).json({ error: '❌ Doctor not found or not associated with this hospital' });
    }
    console.log('DEBUG: createBreastCancerReport - Doctor found:', doctor.id);

    if (!hospital) {
      console.log('DEBUG: createBreastCancerReport - Hospital not found.');
      return res.status(404).json({ error: '❌ Hospital not found' });
    }
    console.log('DEBUG: createBreastCancerReport - Hospital found:', hospital.id);

    // Upload all images to Azure Blob Storage
    console.log('DEBUG: createBreastCancerReport - Starting image uploads to Azure Blob Storage...');
    const uploadPromises = [];
    
    for (const fieldName of requiredImageFields) {
      console.log(`DEBUG: createBreastCancerReport - Preparing upload for image: ${fieldName}`);
      uploadPromises.push(
        uploadToAzureBlob(req.files[fieldName][0], patientId, fieldName)
      );
    }

    const uploadedImages = await Promise.all(uploadPromises);
    console.log('DEBUG: createBreastCancerReport - All images uploaded successfully. Uploaded images data:', uploadedImages.map(img => ({ fieldName: img.fieldName, fileUrl: img.fileUrl })));
    
    // Create an image map that matches the expected format in generateBreastCancerReport
    const imageMap = {};
    uploadedImages.forEach(img => {
      imageMap[img.fieldName] = img.fileUrl;
    });
    console.log('DEBUG: createBreastCancerReport - Image map created:', imageMap);
    
    console.log("DEBUG: createBreastCancerReport - Fetched Entities:", {
      patient: { id: patient.id, firstName: patient.firstName, lastName: patient.lastName },
      doctor: { id: doctor.id, name: doctor.name },
      hospital: { id: hospital.id, name: hospital.name }
    });
    
    // Prepare the report data in the correct format expected by generateBreastCancerReport
    const pdfData = {
      title: title || 'BREAST SCREENING REPORT',
      patient: {
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        address: patient.address || 'Not specified',
        contact: patient.contact || 'Not provided',
        gender: patient.gender || 'Not specified',
        age: patient.age || 'N/A',
        weight: patient.weight || 'N/A',
        height: patient.height || 'N/A'
      },
      doctor: {
        name: doctor.name || '',
        specialization: doctor.specialization || 'General Practitioner'
      },
      hospital: {
        name: hospital.name || 'Unknown Hospital',
        address: hospital.address || 'Address not provided',
        imageUrl: hospital.imageUrl
      },
      images: imageMap
    };
    console.log('DEBUG: createBreastCancerReport - PDF data prepared for generation.');

    // Generate PDF report from the uploaded images
    console.log('DEBUG: createBreastCancerReport - Generating PDF report...');
    const pdfReportData = await generateBreastCancerReport(pdfData);
    console.log(`DEBUG: createBreastCancerReport - PDF report generated. Size: ${pdfReportData.length} bytes.`);

    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().replace(/[:.]/g, '-');
    
    // Upload the generated PDF to Azure Blob Storage
    console.log('DEBUG: createBreastCancerReport - Uploading generated PDF to Azure Blob Storage...');
    const pdfFile = {
      buffer: pdfReportData,
      mimetype: 'application/pdf',
      originalname: `${patient.lastName}_${patient.firstName}_${formattedDate}.pdf`,
      size: pdfReportData.length
    };
    
    const pdfUploadData = await uploadToAzureBlob(pdfFile, patientId, 'generated_pdf_report');
    console.log('DEBUG: createBreastCancerReport - Generated PDF uploaded successfully. URL:', pdfUploadData.fileUrl);

    // Create report record in database
    console.log('DEBUG: createBreastCancerReport - Creating report record in database...');
    const report = await Report.create({
      title: title || 'Breast Cancer Screening Report',
      description: description || 'Breast cancer screening report with 6 images',
      reportType: 'Other', 
      patientId,
      doctorId,
      hospitalId,
      uploadedBy: req.userId || hospitalId,
      fileUrl: pdfUploadData.fileUrl,
      fileName: pdfUploadData.fileName,
      fileType: pdfUploadData.fileType,
      fileSize: pdfUploadData.fileSize || pdfReportData.length,
      metadata: {
        images: uploadedImages.map(img => ({
          position: img.fieldName,
          fileUrl: img.fileUrl,
          blobName: img.blobName
        })),
        generatedAt: new Date().toISOString(),
        generatedBy: doctorId,
        pdfBlobName: pdfUploadData.blobName
      }
    });
    console.log('DEBUG: createBreastCancerReport - Report record created in database. Report ID:', report.id);
    
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
    console.log('DEBUG: createBreastCancerReport - Response sent successfully.');
  } catch (error) {
    console.error("ERROR: createBreastCancerReport - An error occurred:", error);
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
    
    // Upload file to Azure Blob Storage
    const fileData = await uploadToAzureBlob(req.file, patientId, 'general_report');
    
    // Create report record in database
    const report = await Report.create({
      title,
      description,
      reportType: reportType || 'General Report',
      patientId,
      doctorId,
      hospitalId,
      uploadedBy: req.userId || hospitalId,
      fileUrl: fileData.fileUrl,
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize,
      metadata: {
        blobName: fileData.blobName,
        etag: fileData.etag
      }
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
    const doctorId = req.doctorId;
    const hospitalId = req.hospitalId;
    
    patientId = patientId || req.body.patientId;
    
    // Build where clause for patient lookup
    const patientWhere = { id: patientId };
    if (hospitalId && req.role !== 'admin') {
      patientWhere.hospitalId = hospitalId;
    }
    
    // Validate patient exists
    const patient = await Patient.findOne({ 
      where: patientWhere
    });
    
    if (!patient) {
      return res.status(404).json({ error: '❌ Patient not found or not associated with this hospital' });
    }
    
    // Build where clause for reports
    const reportWhere = {
      patientId,
      isDeleted: false
    };
    
    // If doctor, only show reports assigned to them
    if (req.role === 'doctor' && doctorId) {
      reportWhere.assignedDoctorId = doctorId;
    } else if (hospitalId && req.role === 'hospital') {
      // Hospital sees all reports from their hospital
      reportWhere.hospitalId = hospitalId;
    }
    
    const reports = await Report.findAll({
      where: reportWhere,
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
    const doctorId = req.doctorId;
    const hospitalId = req.hospitalId;
    
    const whereClause = {
      id: reportId,
      isDeleted: false
    };
    
    // If doctor, only show reports assigned to them
    if (req.role === 'doctor' && doctorId) {
      whereClause.assignedDoctorId = doctorId;
    } else if (hospitalId && req.role === 'hospital') {
      // Hospital sees all reports from their hospital
      whereClause.hospitalId = hospitalId;
    }
    
    const report = await Report.findOne({
      where: whereClause,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'gender', 'age']
        },
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'name', 'specialization', 'designation']
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
      order: [['id', 'DESC']],
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

// Download a report (proxy the file from Azure Blob Storage)
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
    
    // Stream the file from Azure Blob Storage to the response
    https.get(report.fileUrl, (fileStream) => {
      fileStream.pipe(res);
    }).on('error', (err) => {
      res.status(500).json({ error: `❌ Error downloading file: ${err.message}` });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Assign report to doctor (Hospital assigns report to doctor)
exports.assignReportToDoctor = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { assignedDoctorId } = req.body;
    const hospitalId = req.hospitalId; // From auth middleware

    // Only hospitals and admins can assign reports
    if (req.role !== 'hospital' && req.role !== 'admin') {
      return res.status(403).json({ error: '❌ Only hospitals and admins can assign reports' });
    }

    if (!assignedDoctorId) {
      return res.status(400).json({ error: '❌ Doctor ID is required' });
    }

    // Find report
    const whereClause = {
      id: reportId,
      isDeleted: false
    };
    
    // If hospital, only allow assigning reports from their hospital
    if (req.role === 'hospital' && hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const report = await Report.findOne({ where: whereClause });
    
    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }

    // Validate doctor exists and belongs to the same hospital
    const doctor = await Doctor.findOne({
      where: {
        id: assignedDoctorId,
        hospitalId: report.hospitalId,
        isActive: true
      }
    });

    if (!doctor) {
      return res.status(404).json({ error: '❌ Doctor not found or not active in this hospital' });
    }

    // Assign report to doctor
    await report.update({
      assignedDoctorId: assignedDoctorId,
      assignedAt: new Date()
    });

    res.status(200).json({
      message: '✅ Report assigned to doctor successfully',
      report: {
        id: report.id,
        title: report.title,
        assignedDoctorId: report.assignedDoctorId,
        assignedAt: report.assignedAt,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialization: doctor.specialization
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Unassign report from doctor
exports.unassignReportFromDoctor = async (req, res) => {
  try {
    const { reportId } = req.params;
    const hospitalId = req.hospitalId;

    // Only hospitals and admins can unassign reports
    if (req.role !== 'hospital' && req.role !== 'admin') {
      return res.status(403).json({ error: '❌ Only hospitals and admins can unassign reports' });
    }

    const whereClause = {
      id: reportId,
      isDeleted: false
    };
    
    if (req.role === 'hospital' && hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const report = await Report.findOne({ where: whereClause });
    
    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }

    // Unassign report
    await report.update({
      assignedDoctorId: null,
      assignedAt: null,
      isChecked: false // Reset isChecked when unassigned
    });

    res.status(200).json({
      message: '✅ Report unassigned from doctor successfully',
      report: {
        id: report.id,
        title: report.title,
        assignedDoctorId: null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update isChecked status for assigned report (Only assigned doctor can update)
exports.updateReportCheckedStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { isChecked } = req.body;
    const doctorId = req.doctorId; // From auth middleware

    // Only doctors can update isChecked status
    if (req.role !== 'doctor' || !doctorId) {
      return res.status(403).json({ 
        error: '❌ Only assigned doctors can update the checked status of reports' 
      });
    }

    // Validate isChecked is a boolean
    if (typeof isChecked !== 'boolean') {
      return res.status(400).json({ 
        error: '❌ isChecked must be a boolean value (true or false)' 
      });
    }

    // Find report that is assigned to this doctor
    const report = await Report.findOne({
      where: {
        id: reportId,
        assignedDoctorId: doctorId,
        isDeleted: false
      },
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    if (!report) {
      return res.status(404).json({ 
        error: '❌ Report not found or not assigned to you' 
      });
    }

    // Update isChecked status
    await report.update({
      isChecked: isChecked
    });

    res.status(200).json({
      message: `✅ Report ${isChecked ? 'marked as checked' : 'marked as unchecked'} successfully`,
      report: {
        id: report.id,
        title: report.title,
        reportType: report.reportType,
        patientId: report.patientId,
        patientName: `${report.patient.firstName} ${report.patient.lastName}`,
        assignedDoctorId: report.assignedDoctorId,
        isChecked: report.isChecked,
        assignedAt: report.assignedAt
      }
    });
  } catch (error) {
    console.error('Error updating report checked status:', error);
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
    
    // Delete file from Azure Blob Storage
    await deleteFromAzureBlob(report.fileUrl);
    
    // If this is a breast cancer report, also delete the source images
    if (report.reportType === 'Breast Cancer' && report.metadata && report.metadata.images) {
      const imageDeletePromises = report.metadata.images.map(image => 
        deleteFromAzureBlob(image.fileUrl)
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
    const authDoctorId = req.doctorId;
    const authHospitalId = req.hospitalId;
    
    const whereClause = {
      isDeleted: false
    };
    
    // If doctor, only show reports assigned to them
    if (req.role === 'doctor' && authDoctorId) {
      whereClause.assignedDoctorId = authDoctorId;
    } else if (authHospitalId && req.role === 'hospital') {
      // Hospital sees all reports from their hospital
      whereClause.hospitalId = authHospitalId;
    } else if (req.body.hospitalId && req.role === 'admin') {
      // Admin can filter by hospitalId if provided
      whereClause.hospitalId = req.body.hospitalId;
    }
    
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
          attributes: ['id', 'name', 'specialization', 'designation']
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

// Get all assigned reports for a hospital
exports.getAssignedReportsForHospital = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Debug logging
    console.log('=== getAssignedReportsForHospital DEBUG ===');
    console.log('req.role:', req.role);
    console.log('req.hospitalId:', req.hospitalId);
    console.log('req.user:', req.user ? { id: req.user.id } : 'null');
    console.log('req.hospital:', req.hospital ? { id: req.hospital.id } : 'null');
    console.log('req.params.hospitalId:', req.params.hospitalId);
    console.log('req.path:', req.path);
    console.log('req.url:', req.url);
    console.log('req.originalUrl:', req.originalUrl);
    console.log('==========================================');

    // Check if route was incorrectly matched (hospitalId param is "assigned")
    if (req.params.hospitalId === 'assigned') {
      console.error('❌ Route matching error: /hospital/assigned was matched as /hospital/:hospitalId/assigned');
      // This means the route order is wrong or Express matched incorrectly
      // Force use hospital role logic
      if (req.role === 'hospital') {
        req.params.hospitalId = undefined; // Clear the incorrect param
      }
    }

    // Only hospitals and admins can access this endpoint
    if (req.role !== 'hospital' && req.role !== 'admin') {
      return res.status(403).json({ error: '❌ Only hospitals and admins can access assigned reports' });
    }

    // Determine hospitalId based on role
    let hospitalId;
    
    // STRICT CHECK: If role is hospital, we MUST use token hospitalId, NEVER validate, NEVER use URL param
    if (req.role === 'hospital') {
      // For hospitals, ALWAYS use the hospitalId from auth middleware (already validated by auth)
      // IGNORE any hospitalId in URL params - hospitals can only see their own reports
      // Try multiple sources in order of preference
      hospitalId = req.hospitalId || req.hospital?.id || req.user?.id;
      
      if (!hospitalId) {
        console.error('❌ Hospital ID not found in any source');
        return res.status(400).json({ 
          error: '❌ Hospital ID not found in token',
          debug: {
            hospitalId: req.hospitalId,
            hospitalObj: req.hospital ? { id: req.hospital.id } : null,
            userObj: req.user ? { id: req.user.id } : null,
            role: req.role
          }
        });
      }
      
      // Ensure it's a number
      hospitalId = Number(hospitalId);
      if (isNaN(hospitalId) || hospitalId <= 0) {
        return res.status(400).json({ error: '❌ Invalid Hospital ID in token' });
      }
      
      console.log('✅ Hospital role - Using hospitalId from token:', hospitalId);
      console.log('✅ Skipping hospital validation (already done by auth middleware)');
      // NO hospital validation needed - auth middleware already validated it exists
      // Proceed directly to query
      
    } else if (req.role === 'admin') {
      // For admins, get hospitalId from params (URL parameter)
      // IMPORTANT: Only execute this if role is EXACTLY 'admin'
      if (req.role !== 'admin') {
        console.error('❌ CRITICAL: Admin code path executed but role is:', req.role);
        return res.status(500).json({ error: '❌ Internal server error: Invalid role check' });
      }
      
      hospitalId = req.params.hospitalId;
      
      // Ignore if hospitalId is "assigned" (route matching error)
      if (hospitalId === 'assigned') {
        return res.status(400).json({ 
          error: '❌ Invalid hospital ID. Please use /api/reports/hospital/:hospitalId/assigned with a valid hospital ID' 
        });
      }
      
      if (!hospitalId) {
        return res.status(400).json({ error: '❌ Hospital ID is required in URL for admin requests' });
      }
      
      // Convert to number
      hospitalId = Number(hospitalId);
      if (isNaN(hospitalId) || hospitalId <= 0) {
        return res.status(400).json({ error: '❌ Invalid Hospital ID format' });
      }
      
      // Validate hospital exists (only for admin requests)
      console.log('Admin: Validating hospital exists with ID:', hospitalId);
      const hospital = await Hospital.findByPk(hospitalId);
      if (!hospital) {
        console.error('Admin: Hospital not found with ID:', hospitalId);
        return res.status(404).json({ error: '❌ Hospital not found' });
      }
      console.log('Admin: Hospital found:', hospital.id);
      
      console.log('✅ Admin accessing hospitalId:', hospitalId);
    } else {
      console.error('❌ Unexpected role:', req.role);
      return res.status(403).json({ error: '❌ Unauthorized access' });
    }

    // If hospital role, ensure they can only see their own reports
    const whereClause = {
      hospitalId: hospitalId,
      assignedDoctorId: { [Op.ne]: null }, // Only reports that are assigned
      isDeleted: false
    };

    const { count, rows: reports } = await Report.findAndCountAll({
      where: whereClause,
      attributes: [
        'id', 'title', 'reportType', 'patientId',
        'fileName', 'fileUrl', 'uploadedAt', 'assignedAt',
        'assignedDoctorId', 'doctorId', 'status', 'annotatedFileUrl'
      ],
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'gender', 'age']
        },
        {
          model: Doctor,
          as: 'assignedDoctor',
          attributes: ['id', 'name', 'specialization']
        },
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'name', 'specialization'],
          required: false
        }
      ],
      order: [['assignedAt', 'DESC']],
      limit: pageSize,
      offset: offset
    });

    if (count === 0) {
      return res.status(200).json({ 
        message: 'No assigned reports found for this hospital',
        totalItems: 0,
        totalPages: 0,
        currentPage: page,
        pageSize: pageSize,
        reports: []
      });
    }

    res.status(200).json({
      totalItems: count,
      totalPages: Math.ceil(count / pageSize),
      currentPage: page,
      pageSize: pageSize,
      reports: reports.map(report => ({
        id: report.id,
        title: report.title,
        reportType: report.reportType,
        patientId: report.patientId,
        patientName: `${report.patient.firstName} ${report.patient.lastName}`,
        patient: {
          id: report.patient.id,
          firstName: report.patient.firstName,
          lastName: report.patient.lastName,
          gender: report.patient.gender,
          age: report.patient.age
        },
        assignedDoctorId: report.assignedDoctorId,
        assignedDoctor: report.assignedDoctor ? {
          id: report.assignedDoctor.id,
          name: report.assignedDoctor.name,
          specialization: report.assignedDoctor.specialization
        } : null,
        doctorId: report.doctorId,
        doctor: report.doctor ? {
          id: report.doctor.id,
          name: report.doctor.name,
          specialization: report.doctor.specialization
        } : null,
        fileName: report.fileName,
        fileUrl: report.fileUrl,
        uploadedAt: report.uploadedAt,
        assignedAt: report.assignedAt,
        status: report.status,
        annotatedFileUrl: report.annotatedFileUrl
      }))
    });
  } catch (error) {
    console.error('Error fetching assigned reports for hospital:', error);
    res.status(500).json({ error: error.message });
  }
};

// Download all hospital reports as a ZIP file
exports.downloadHospitalReportsZip = async (req, res) => {
  try {
    const { hospitalId: hospitalIdParam } = req.params;
    const hospitalIdBody = req.body ? req.body.hospitalId : undefined;
    const hospitalId = hospitalIdParam || hospitalIdBody;
    
    // Get date filters from query params or body
    const startDate = req.query.startDate || (req.body ? req.body.startDate : undefined);
    const endDate = req.query.endDate || (req.body ? req.body.endDate : undefined);

    if (!hospitalId) {
      return res.status(400).json({ error: '❌ hospitalId is required' });
    }

    const hospital = await Hospital.findByPk(hospitalId, { attributes: ['id', 'name'] });
    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }

    // Build where clause with date filters
    const whereClause = {
      hospitalId,
      isDeleted: false
    };

    // Add date range filter if provided
    if (startDate || endDate) {
      whereClause.uploadedAt = {};
      if (startDate) {
        whereClause.uploadedAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        // Set endDate to end of day (23:59:59.999) to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.uploadedAt[Op.lte] = endDateTime;
      }
    }

    const reports = await Report.findAll({
      where: whereClause,
      attributes: ['id', 'fileName', 'fileUrl', 'uploadedAt']
    });

    if (!reports || reports.length === 0) {
      return res.status(404).json({ error: '❌ No reports found for this hospital' });
    }

    const datePart = new Date().toISOString().slice(0, 10);
    const baseName = (hospital.name || `hospital_${hospital.id}`)
      .toString()
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    
    // Include date range in filename if filters are applied
    let dateRangeSuffix = '';
    if (startDate || endDate) {
      const start = startDate ? startDate.slice(0, 10) : 'all';
      const end = endDate ? endDate.slice(0, 10) : 'all';
      dateRangeSuffix = `_${start}_to_${end}`;
    }
    
    const zipFileName = `${baseName}_reports${dateRangeSuffix}_${datePart}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('ZIP archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: `❌ Error creating ZIP: ${err.message}` });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    // Helper to generate a safe filename for the zip entry
    const toSafeEntryName = (report) => {
      const uploadedAt = report.uploadedAt ? new Date(report.uploadedAt).toISOString().replace(/[:.]/g, '-') : 'unknown-date';
      const safeName = (report.fileName || `report_${report.id}`)
        .toString()
        .replace(/[/\\]/g, '-')
        .replace(/\s+/g, '_');
      return `${uploadedAt}_${report.id}_${safeName}`;
    };

    // Stream each report file into the archive sequentially to avoid high memory/connection usage
    for (const report of reports) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        try {
          https.get(report.fileUrl, (fileStream) => {
            fileStream.on('error', reject);
            archive.append(fileStream, { name: toSafeEntryName(report) });
            fileStream.on('end', resolve);
          }).on('error', reject);
        } catch (err) {
          reject(err);
        }
      });
    }

    // Finalize the archive (sends remaining data to the response)
    archive.finalize();
  } catch (error) {
    console.error('Error creating hospital reports ZIP:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
};

// Annotate report with overlay PNG
exports.annotateReport = async (req, res) => {
  try {
    const { report_id, overlay, remarks } = req.body;

    // Validate input
    if (!report_id || !overlay) {
      return res.status(400).json({ error: '❌ report_id and overlay are required' });
    }

    // Fetch the report
    const report = await Report.findOne({
      where: {
        id: report_id,
        isDeleted: false
      }
    });

    if (!report) {
      return res.status(404).json({ error: '❌ Report not found' });
    }

    // Get the original PDF URL
    const fileUrl = report.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ error: '❌ Report file URL not found' });
    }

    // Download the original PDF from Azure Blob
    let originalPdfBuffer;
    try {
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      originalPdfBuffer = Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading PDF from Azure:', error);
      return res.status(500).json({ error: '❌ Failed to download original PDF from Azure' });
    }

    // Clean the overlay base64
    const overlayBase64 = overlay.split(',')[1];
    if (!overlayBase64) {
      return res.status(400).json({ error: '❌ Invalid overlay format. Expected data:image/png;base64,...' });
    }

    let overlayBuffer;
    try {
      overlayBuffer = Buffer.from(overlayBase64, 'base64');
    } catch (error) {
      console.error('Error decoding overlay:', error);
      return res.status(400).json({ error: '❌ Failed to decode overlay base64' });
    }

    // Merge overlay PNG onto the original PDF using pdf-lib
    let annotatedPdfBuffer;
    try {
      const pdfDoc = await PDFLibDocument.load(originalPdfBuffer);
      const png = await pdfDoc.embedPng(overlayBuffer);

      const page = pdfDoc.getPage(0);
      const { width, height } = page.getSize();

      page.drawImage(png, {
        x: 0,
        y: 0,
        width,
        height
      });

      const finalPdf = await pdfDoc.save();
      annotatedPdfBuffer = Buffer.from(finalPdf);
    } catch (error) {
      console.error('Error merging PDF with overlay:', error);
      return res.status(500).json({ error: '❌ Failed to merge overlay with PDF' });
    }

    // Upload the new annotated PDF to Azure using existing upload helper
    const annotatedPdfFile = {
      buffer: annotatedPdfBuffer,
      originalname: `annotated-report-${report_id}.pdf`,
      mimetype: 'application/pdf',
      size: annotatedPdfBuffer.length
    };

    let annotatedFileUrl;
    try {
      const uploadResult = await uploadToAzureBlob(annotatedPdfFile, report.patientId, 'annotated_report');
      annotatedFileUrl = uploadResult.fileUrl;
    } catch (error) {
      console.error('Error uploading annotated PDF to Azure:', error);
      return res.status(500).json({ error: '❌ Failed to upload annotated PDF to Azure' });
    }

    // Update the Report record
    try {
      await report.update({
        annotatedFileUrl: annotatedFileUrl,
        remarks: remarks || null,
        status: 'reviewed',
        reviewedAt: new Date(),
        isChecked: true,
        doctorId: req.user.id
      });
    } catch (error) {
      console.error('Error updating report:', error);
      return res.status(500).json({ error: '❌ Failed to update report record' });
    }

    // Return success response
    res.status(200).json({
      success: true,
      annotated_pdf_url: annotatedFileUrl
    });
  } catch (error) {
    console.error('Error in annotateReport:', error);
    res.status(500).json({ error: error.message || '❌ Internal server error' });
  }
};