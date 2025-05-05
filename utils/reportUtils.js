const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { format } = require('util');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');

/**
 * Upload a patient report file to Google Cloud Storage
 * @param {object} file - The file object from multer middleware
 * @param {number} patientId - The ID of the patient
 * @param {string} fileType - Type identifier for the file (for organization)
 * @returns {Promise<object>} The file metadata including URL
 */
exports.uploadReportFile = async (file, patientId, fileType = 'general') => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const storage = new Storage({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });

    const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);

    // Create a more structured file name with patient ID and timestamp
    const timestamp = Date.now();
    const typePrefix = fileType ? `${fileType}_` : '';
    const fileName = `patient_${patientId}_${typePrefix}${timestamp}${path.extname(file.originalname)}`;
    const blob = bucket.file(`reports/${fileName}`);
    
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', (error) => {
        reject(new Error(`Failed to upload report: ${error.message}`));
      });

      blobStream.on('finish', () => {
        const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
        
        // Return file metadata along with the URL
        resolve({
          fileUrl: publicUrl,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          fieldName: fileType // Pass along the field identifier
        });
      });
      
      blobStream.end(file.buffer);
    });
  } catch (error) {
    throw new Error(`Error uploading report to Google Cloud Storage: ${error.message}`);
  }
};

/**
 * Delete a report file from Google Cloud Storage
 * @param {string} fileUrl - The public URL of the file to delete
 * @returns {Promise<boolean>}
 */
exports.deleteReportFile = async (fileUrl) => {
  try {
    const storage = new Storage({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });

    const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);

    // Extract the file path from the URL
    const urlParts = fileUrl.split(`https://storage.googleapis.com/${bucketName}/`);
    if (urlParts.length !== 2) {
      throw new Error('Invalid file URL format');
    }
    
    const filePath = urlParts[1];
    await bucket.file(filePath).delete();
    
    return true;
  } catch (error) {
    throw new Error(`Error deleting report from Google Cloud Storage: ${error.message}`);
  }
};

/**
 * Generate a breast cancer PDF report from uploaded images
 * @param {Array<object>} uploadedImages - Array of uploaded image data
 * @param {object} patient - Patient data
 * @param {object} doctor - Doctor data
 * @param {string} title - Report title
 * @returns {Promise<Buffer>} PDF document as buffer
 */
exports.generateBreastCancerReport = async (uploadedImages, patient, doctor, title) => {
  try {
    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: title,
        Author: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        Subject: 'Breast Cancer Screening Report',
        Keywords: 'breast cancer, screening, medical report'
      }
    });

    // Stream to collect PDF data
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    // Create a promise that resolves when the PDF is finished
    const pdfPromise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Add hospital header/logo
    doc.fontSize(20).text('Medical Center', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown();
    
    // Patient and doctor information
    doc.fontSize(12).text('Patient Information:', { underline: true });
    doc.text(`Name: ${patient.firstName} ${patient.lastName}`);
    doc.text(`Patient ID: ${patient.id}`);
    doc.text(`Gender: ${patient.gender}`);
    doc.text(`Age: ${patient.age}`);
    doc.moveDown();
    
    doc.text('Doctor Information:', { underline: true });
    doc.text(`Name: Dr. ${doctor.firstName} ${doctor.lastName}`);
    doc.text(`Specialization: ${doctor.specialization}`);
    doc.text(`Doctor ID: ${doctor.id}`);
    doc.moveDown();
    
    doc.text('Examination Date: ' + new Date().toLocaleDateString());
    doc.moveDown();

    // Report overview
    doc.fontSize(14).text('Breast Cancer Screening Report', { underline: true });
    doc.fontSize(12).text('This report contains images from multiple angles of both breasts for screening purposes.');
    doc.moveDown();

    // Process and add images to the PDF
    // First, download the images
    const imageBuffers = {};
    for (const img of uploadedImages) {
      const response = await axios.get(img.fileUrl, { responseType: 'arraybuffer' });
      
      // Resize images to fit properly in the PDF
      const processedImage = await sharp(response.data)
        .resize(250) // Resize to reasonable width while maintaining aspect ratio
        .toBuffer();
        
      imageBuffers[img.fieldName] = processedImage;
    }

    // Left breast images section
    doc.addPage();
    doc.fontSize(16).text('Left Breast Images', { align: 'center' });
    doc.moveDown();

    // Add left breast images in a row
    const leftImages = ['leftTopImage', 'leftCenterImage', 'leftBottomImage'];
    const leftImageLabels = ['Top View', 'Center View', 'Bottom View'];
    
    // First image with label
    if (imageBuffers['leftTopImage']) {
      doc.image(imageBuffers['leftTopImage'], {
        fit: [250, 250],
        align: 'center'
      });
      doc.fontSize(10).text('Left Breast - Top View', { align: 'center' });
    }
    
    doc.moveDown();

    // Second image with label
    if (imageBuffers['leftCenterImage']) {
      doc.image(imageBuffers['leftCenterImage'], {
        fit: [250, 250],
        align: 'center'
      });
      doc.fontSize(10).text('Left Breast - Center View', { align: 'center' });
    }
    
    doc.moveDown();

    // Third image with label
    if (imageBuffers['leftBottomImage']) {
      doc.image(imageBuffers['leftBottomImage'], {
        fit: [250, 250],
        align: 'center'
      });
      doc.fontSize(10).text('Left Breast - Bottom View', { align: 'center' });
    }

    // Right breast images section
    doc.addPage();
    doc.fontSize(16).text('Right Breast Images', { align: 'center' });
    doc.moveDown();

    // First image with label
    if (imageBuffers['rightTopImage']) {
      doc.image(imageBuffers['rightTopImage'], {
        fit: [250, 250],
        align: 'center'
      });
      doc.fontSize(10).text('Right Breast - Top View', { align: 'center' });
    }
    
    doc.moveDown();

    // Second image with label
    if (imageBuffers['rightCenterImage']) {
      doc.image(imageBuffers['rightCenterImage'], {
        fit: [250, 250],
        align: 'center'
      });
      doc.fontSize(10).text('Right Breast - Center View', { align: 'center' });
    }
    
    doc.moveDown();

    // Third image with label
    if (imageBuffers['rightBottomImage']) {
      doc.image(imageBuffers['rightBottomImage'], {
        fit: [250, 250],
        align: 'center'
      });
      doc.fontSize(10).text('Right Breast - Bottom View', { align: 'center' });
    }

    // Add findings and recommendations section
    doc.addPage();
    doc.fontSize(16).text('Findings and Recommendations', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).text('Findings:', { underline: true });
    doc.text('The images have been submitted for analysis. Detailed findings will be provided after review by the specialist.');
    doc.moveDown();
    
    doc.text('Recommendations:', { underline: true });
    doc.text('Please await the specialist\'s analysis and follow-up recommendations.');
    doc.moveDown(2);
    
    // Signature section
    doc.text(`Doctor's Signature: ______________________`, { align: 'right' });
    doc.moveDown();
    doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });

    // Finalize the PDF
    doc.end();
    
    // Return the PDF buffer
    return await pdfPromise;
  } catch (error) {
    throw new Error(`Error generating breast cancer report: ${error.message}`);
  }
};