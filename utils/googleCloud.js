const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { format } = require('util');

const storage = new Storage({
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME;
const bucket = storage.bucket(bucketName);

/**
 * Upload a file to Google Cloud Storage
 * @param {object} file - The file object from multer middleware
 * @returns {Promise<string>} The public URL of the uploaded file
 */
exports.uploadImage = async (file) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

   
    const fileName = `hospital_${Date.now()}${path.extname(file.originalname)}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });
    return new Promise((resolve, reject) => {
      blobStream.on('error', (error) => {
        reject(new Error(`Failed to upload image: ${error.message}`));
      });

      blobStream.on('finish', () => {
        const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
        resolve(publicUrl);
      });
      blobStream.end(file.buffer);
    });
  } catch (error) {
    throw new Error(`Error uploading to Google Cloud Storage: ${error.message}`);
  }
};

/**
 * Delete a file from Google Cloud Storage
 * @param {string} fileUrl - The public URL of the file to delete
 * @returns {Promise<void>}
 */
exports.deleteImage = async (fileUrl) => {
  try {

    const fileName = fileUrl.split('/').pop();
    await bucket.file(fileName).delete();
    return true;
  } catch (error) {
    throw new Error(`Error deleting from Google Cloud Storage: ${error.message}`);
  }
};