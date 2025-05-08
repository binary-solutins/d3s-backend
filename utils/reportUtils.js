const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { format } = require('util');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');

/**
 * Generate a professional breast cancer report from uploaded images
 * @param {Array<object>} uploadedImages - Array of uploaded image data
 * @param {object} patient - Patient data
 * @param {object} doctor - Doctor data
 * @param {object} hospital - Hospital data
 * @param {string} title - Report title
 * @returns {Promise<Buffer>} PDF document as buffer
 */
exports.generateBreastCancerReport = async (uploadedImages, patient, doctor, hospital, title) => {
  try {
    // Create a new PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
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

    // Helper function to draw a rectangular box
    const drawBox = (x, y, width, height, title, fillColor) => {
      doc.roundedRect(x, y, width, height, 5)
        .fillAndStroke(fillColor || '#f0f0f0', '#000000');
      
      if (title) {
        doc.fillColor('#000000')
          .fontSize(10)
          .text(title, x + 5, y + 5, { width: width - 10 });
      }
      
      return { x, y, width, height };
    };

    // Logo and Header
    const pageWidth = doc.page.width - 2 * doc.page.margins.left;
    
    // Title header with logo
    doc.image(await fetchLogo(), 25, 25, { width: 60 });
    
    // Report title top-center
    doc.fontSize(16)
      .fillColor('#000')
      .text("BR - Scan", 90, 30, { align: 'left' });
    
    doc.fontSize(14)
      .fillColor('#000')
      .text(title.toUpperCase(), 210, 30, { align: 'left' });
    
    // Add date with current timestamp
    const currentDate = new Date();
    const formattedDate = `${currentDate.getDate()} ${getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}, ${formatTime(currentDate)}`;
    doc.fontSize(10)
      .text(`Date: ${formattedDate}`, 210, 50, { align: 'left' });
    
    // Add hospital logo on right
    doc.image(await fetchHospitalLogo(), doc.page.width - 85, 25, { width: 60 });
    
    doc.moveTo(40, 80).lineTo(doc.page.width - 40, 80).stroke();
    
    // Information boxes
    const boxHeight = 85;
    
    // Draw the two main info boxes
    const leftBoxWidth = 250;
    const rightBoxWidth = 250;
    const startY = 95;
    
    // Subject details box (left side)
    drawBox(40, startY, leftBoxWidth, boxHeight, 'Subject Details', '#f0f0f0');
    
    // Examiner details box (right side)
    drawBox(doc.page.width - 40 - rightBoxWidth, startY, rightBoxWidth, boxHeight, 'Examiner Details', '#f0f0f0');
    
    // Patient information (left side)
    doc.fontSize(9)
      .fillColor('#000')
      .text(`Patient Name:`, 50, startY + 20)
      .text(`${patient.firstName} ${patient.lastName}`, 130, startY + 20);
    
    doc.text(`Address:`, 50, startY + 32)
      .text(`${patient.address}`, 130, startY + 32);
    
    doc.text(`Contact:`, 50, startY + 44)
      .text(`${patient.contact}`, 130, startY + 44);
    
    doc.text(`Gender:`, 50, startY + 56)
      .text(`${patient.gender}`, 130, startY + 56);
    
    doc.text(`Age:`, 50, startY + 68)
      .text(`${patient.age} Years`, 130, startY + 68);
    
    doc.text(`Weight:`, 170, startY + 56)
      .text(`${patient.weight} kg`, 210, startY + 56);
    
    doc.text(`Height:`, 170, startY + 68)
      .text(`${patient.height}`, 210, startY + 68);
    
    // Doctor information (right side)
    const doctorStartX = doc.page.width - 40 - rightBoxWidth + 10;
    
    doc.fontSize(9)
      .fillColor('#000')
      .text(`Hospital Name:`, doctorStartX, startY + 20)
      .text(`${hospital.name}`, doctorStartX + 80, startY + 20);
    
    doc.text(`Hospital Address:`, doctorStartX, startY + 32)
      .text(`${hospital.address}`, doctorStartX + 80, startY + 32);
    
    doc.text(`Doctor Name:`, doctorStartX, startY + 44)
      .text(`Dr. ${doctor.firstName} ${doctor.lastName}`, doctorStartX + 80, startY + 44);
    
    doc.text(`Designation:`, doctorStartX, startY + 56)
      .text(`${doctor.specialization}`, doctorStartX + 80, startY + 56);
    
    doc.text(`Screening Place:`, doctorStartX, startY + 68)
      .text(`${patient.address.split(',')[0]}`, doctorStartX + 80, startY + 68);
    
    // Left Breast section
    const leftBreastY = startY + boxHeight + 20;
    
    // Left breast icon and title
    drawBreastIcon(doc, 160, leftBreastY, '#FFB6C1');
    
    doc.fontSize(12)
      .fillColor('#000')
      .text('Left Breast Screening Visuals', 190, leftBreastY + 5);
    
    // Image labels
    const imageLabelsY = leftBreastY + 30;
    doc.fontSize(9)
      .fillColor('#000')
      .text('I. Top Side Image', 75, imageLabelsY)
      .text('II. Left Side Image', 250, imageLabelsY)
      .text('III. Right Side Image', 425, imageLabelsY);
    
    // Process and add images to the PDF
    // First, download the images
    const imageBuffers = {};
    
    // Download all images first
    const downloadPromises = uploadedImages.map(async (img) => {
      try {
        const response = await axios.get(img.fileUrl, { responseType: 'arraybuffer' });
        
        // Resize images to fit properly in the PDF
        const processedImage = await sharp(response.data)
          .resize(150) // Resize to reasonable width while maintaining aspect ratio
          .toBuffer();
          
        imageBuffers[img.fieldName] = processedImage;
      } catch (error) {
        console.error(`Error downloading image ${img.fieldName}:`, error.message);
      }
    });
    
    // Wait for all images to download
    await Promise.all(downloadPromises);
    
    console.log("Downloaded image fields:", Object.keys(imageBuffers));
    
    // Add left breast images in a row
    const leftBreastImagesY = imageLabelsY + 15;
    const imageWidth = 130;
    const imageGap = 20;
    
    // Add left breast images
    if (imageBuffers['leftTopImage']) {
      doc.image(imageBuffers['leftTopImage'], 40, leftBreastImagesY, {
        fit: [imageWidth, imageWidth],
      });
    }
    
    if (imageBuffers['leftCenterImage']) {
      doc.image(imageBuffers['leftCenterImage'], 40 + imageWidth + imageGap, leftBreastImagesY, {
        fit: [imageWidth, imageWidth],
      });
    }
    
    if (imageBuffers['leftBottomImage']) {
      doc.image(imageBuffers['leftBottomImage'], 40 + 2 * (imageWidth + imageGap), leftBreastImagesY, {
        fit: [imageWidth, imageWidth],
      });
    }
    
    // Right breast section
    const rightBreastY = leftBreastImagesY + imageWidth + 40;
    
    // Right breast icon and title
    drawBreastIcon(doc, 160, rightBreastY, '#FFB6C1');
    
    doc.fontSize(12)
      .fillColor('#000')
      .text('Right Breast Screening Visuals', 190, rightBreastY + 5);
    
    // Image labels
    const rightImageLabelsY = rightBreastY + 30;
    doc.fontSize(9)
      .fillColor('#000')
      .text('I. Top Side Image', 75, rightImageLabelsY)
      .text('II. Center Side Image', 250, rightImageLabelsY)
      .text('III. Bottom Side Image', 425, rightImageLabelsY);
    
    // Add right breast images in a row
    const rightBreastImagesY = rightImageLabelsY + 15;
    
    // Add right breast images
    if (imageBuffers['rightTopImage']) {
      doc.image(imageBuffers['rightTopImage'], 40, rightBreastImagesY, {
        fit: [imageWidth, imageWidth],
      });
    }
    
    if (imageBuffers['rightCenterImage']) {
      doc.image(imageBuffers['rightCenterImage'], 40 + imageWidth + imageGap, rightBreastImagesY, {
        fit: [imageWidth, imageWidth],
      });
    }
    
    if (imageBuffers['rightBottomImage']) {
      doc.image(imageBuffers['rightBottomImage'], 40 + 2 * (imageWidth + imageGap), rightBreastImagesY, {
        fit: [imageWidth, imageWidth],
      });
    }
    // Comments section
    const commentsY = rightBreastImagesY + imageWidth + 30;
    doc.fontSize(10)
      .fillColor('#000')
      .text('Remarks:', 40, commentsY);
    
    doc.moveTo(80, commentsY + 2)
      .lineTo(doc.page.width - 40, commentsY + 2)
      .stroke();
    
    doc.moveTo(40, commentsY + 20)
      .lineTo(doc.page.width - 40, commentsY + 20)
      .stroke();
    
    // Disclaimer and footer
    const disclaimerY = commentsY + 40;
    doc.fontSize(8)
      .fillColor('#800000')
      .text('Disclaimer:', 40, disclaimerY, { continued: true })
      .fillColor('#000')
      .text(' The Breast screening report we provide is based on what we can see in the images. It', { continued: false });
    
    doc.fontSize(8)
      .fillColor('#000')
      .text('might change once the screening is done at the hospital itself. The staff will help with the future', 40, disclaimerY + 10, { continued: false });
    
    doc.fontSize(8)
      .fillColor('#000')
      .text('steps; diagnostic treatments. Please talk to your doctor, gynecologist, oncologist, or surgeon.', 40, disclaimerY + 20, { continued: false });
    
    // Powered by section
    doc.fontSize(8)
      .fillColor('#000')
      .text('Powered by', 470, disclaimerY + 15);
    
    // Add AWS logo
    doc.image(await fetchAWSLogo(), 520, disclaimerY + 5, { width: 25 });
    
    // Finalize the PDF
    doc.end();
    console.log("Image buffers created:", Object.keys(imageBuffers));
    
    // Return the PDF buffer
    return await pdfPromise;
  } catch (error) {
    console.error("Error in generateBreastCancerReport:", error);
    throw new Error(`Error generating breast cancer report: ${error.message}`);
  }
};

/**
 * Draw a breast icon with a circle and fill color
 * @param {PDFDocument} doc - PDFKit document
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} fillColor - Fill color for the icon
 */
function drawBreastIcon(doc, x, y, fillColor) {
  doc.circle(x, y + 10, 15)
    .fillAndStroke(fillColor, '#000000');
}

/**
 * Get month name from month index
 * @param {number} monthIndex - Month index (0-11)
 * @returns {string} Month name
 */
function getMonthName(monthIndex) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[monthIndex];
}

/**
 * Format time as HH:MM am/pm
 * @param {Date} date - Date object
 * @returns {string} Formatted time
 */
function formatTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
  
  return `${hours}:${formattedMinutes} ${ampm}`;
}

/**
 * Fetch the BR-Scan logo
 * @returns {Promise<Buffer>} Logo buffer
 */
async function fetchLogo() {
  try {
    // This is a placeholder - in a real application, you would fetch the logo from a server or storage
    // For now, we'll create a simple SVG logo
    const svgLogo = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="white"/>
        <text x="15" y="40" font-family="Arial" font-size="20" fill="black">BR</text>
        <text x="15" y="60" font-family="Arial" font-size="15" fill="#FF69B4">Scan</text>
        <path d="M75,50 C75,35 60,20 45,20 C30,20 15,35 15,50" stroke="#FF69B4" stroke-width="2" fill="none"/>
      </svg>
    `;
    
    // Convert SVG to PNG
    return await sharp(Buffer.from(svgLogo))
      .resize(100, 100)
      .toBuffer();
  } catch (error) {
    console.error('Error fetching logo:', error);
    // Return an empty buffer if there's an error
    return Buffer.from([]);
  }
}

/**
 * Fetch the hospital logo
 * @returns {Promise<Buffer>} Hospital logo buffer
 */
async function fetchHospitalLogo() {
  try {
    // This is a placeholder - in a real application, you would fetch the logo from a server or storage
    const svgLogo = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#4CAF50"/>
        <circle cx="50" cy="50" r="35" fill="white"/>
        <text x="35" y="45" font-family="Arial" font-size="20" fill="#FF4500">GH</text>
        <text x="25" y="65" font-family="Arial" font-size="10" fill="#FF4500">MEHSANA</text>
      </svg>
    `;
    
    // Convert SVG to PNG
    return await sharp(Buffer.from(svgLogo))
      .resize(100, 100)
      .toBuffer();
  } catch (error) {
    console.error('Error fetching hospital logo:', error);
    // Return an empty buffer if there's an error
    return Buffer.from([]);
  }
}

/**
 * Fetch the AWS logo
 * @returns {Promise<Buffer>} AWS logo buffer
 */
async function fetchAWSLogo() {
  try {
    // This is a placeholder - in a real application, you would fetch the logo from a server or storage
    const svgLogo = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="white"/>
        <text x="15" y="50" font-family="Arial" font-weight="bold" font-size="20" fill="#232F3E">AWS</text>
      </svg>
    `;
    
    // Convert SVG to PNG
    return await sharp(Buffer.from(svgLogo))
      .resize(100, 100)
      .toBuffer();
  } catch (error) {
    console.error('Error fetching AWS logo:', error);
    // Return an empty buffer if there's an error
    return Buffer.from([]);
  }
}