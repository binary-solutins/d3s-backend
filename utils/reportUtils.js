/**
 * Upload a patient report file to Google Cloud Storage
 * @param {object} file - The file object from multer middleware
 * @param {number} patientId - The ID of the patient
 * @returns {Promise<object>} The file metadata including URL
 */
exports.uploadReportFile = async (file, patientId) => {
    try {
      if (!file) {
        throw new Error('No file provided');
      }
  
      const { Storage } = require('@google-cloud/storage');
      const path = require('path');
      const { format } = require('util');
  
      const storage = new Storage({
        keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      });
  
      const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
      const bucket = storage.bucket(bucketName);
  
      // Create a more structured file name with patient ID and timestamp
      const fileName = `patient_${patientId}_report_${Date.now()}${path.extname(file.originalname)}`;
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
            fileSize: file.size
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
      const { Storage } = require('@google-cloud/storage');
      
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