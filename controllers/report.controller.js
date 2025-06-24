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
        blobCacheControl: 'public, max-age=31536000', // Cache for 1 year
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
        preserveQuality: 'true'
      },
      tier: 'Hot', // For frequently accessed files
      conditions: {},
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