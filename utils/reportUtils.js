const fs = require('fs');
const path = require('path');
const jsPDF = require('jspdf');
require('jspdf-html2canvas');
const sharp = require('sharp');
const axios = require('axios');

/**
 * Generate a PDF breast screening report using jsPDF with dynamic data
 * @param {Object} reportData - The report data containing all information
 * @returns {Promise<Buffer>} - The generated PDF as a buffer
 */
const generateBreastCancerReport = async (reportData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Extract the data
      const { patient, doctor, hospital, images, title } = reportData;

      // Process images
      const processedImages = await processImages(images);
      
      // Load logos
      const [breastIcon, hospitalLogo, awsLogo] = await Promise.all([
        getBreastIcon(),
        getHospitalLogo(hospital?.imageUrl),
        getAWSLogo()
      ]);

      // Format date
      const currentDate = new Date();
      const formattedDate = formatDate(currentDate);
      
      // Create PDF using jsPDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set up page dimensions
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      // Add pink border around the entire page
      doc.setDrawColor(255, 182, 193); // Pink color
      doc.setLineWidth(1.5);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

      // Header Section
      let yPosition = 25;
      
      // Add main logo (left)
      try {
        const mainLogoResponse = await axios.get('https://fra.cloud.appwrite.io/v1/storage/buckets/681a95120019afd4e319/files/685b238500142409a042/view?project=681a94cb0031df448ed3&', { responseType: 'arraybuffer' });
        const mainLogoBuffer = await sharp(mainLogoResponse.data)
          .resize(40, 30, { fit: 'contain' })
          .png()
          .toBuffer();
        const mainLogoDataUrl = `data:image/png;base64,${mainLogoBuffer.toString('base64')}`;
        doc.addImage(mainLogoDataUrl, 'PNG', margin, yPosition - 5, 40, 30);
      } catch (error) {
        console.warn('Could not load main logo, using fallback');
      }

      // Title (center)
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const titleText = title || "BREAST SCREENING REPORT";
      const titleWidth = doc.getTextWidth(titleText);
      doc.text(titleText, (pageWidth - titleWidth) / 2, yPosition + 5);

      // Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const dateWidth = doc.getTextWidth(formattedDate);
      doc.text(formattedDate, (pageWidth - dateWidth) / 2, yPosition + 15);

      // Hospital logo (right)
      if (hospitalLogo) {
        const logoBuffer = Buffer.from(hospitalLogo.split(',')[1], 'base64');
        doc.addImage(hospitalLogo, 'PNG', pageWidth - margin - 25, yPosition - 5, 25, 25);
      }

      yPosition += 40;

      // Draw separator line
      doc.setDrawColor(221, 221, 221);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // Details Section
      await addDetailsSection(doc, patient, doctor, hospital, margin, yPosition, contentWidth);
      yPosition += 80;

      // Left Breast Screening Section
      yPosition = await addBreastScreeningSection(
        doc, 
        'Left Breast Screening Visuals', 
        processedImages.leftTopImage, 
        processedImages.leftCenterImage, 
        processedImages.leftBottomImage,
        breastIcon,
        margin, 
        yPosition, 
        contentWidth
      );

      yPosition += 20;

      // Right Breast Screening Section
      yPosition = await addBreastScreeningSection(
        doc, 
        'Right Breast Screening Visuals', 
        processedImages.rightTopImage, 
        processedImages.rightCenterImage, 
        processedImages.rightBottomImage,
        breastIcon,
        margin, 
        yPosition, 
        contentWidth
      );

      // Add remarks section
      yPosition += 20;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Remarks:', margin, yPosition);
      
      // Add lines for remarks
      doc.setDrawColor(221, 221, 221);
      doc.line(margin, yPosition + 10, pageWidth - margin, yPosition + 10);
      doc.line(margin, yPosition + 20, pageWidth - margin, yPosition + 20);

      // Footer
      await addFooter(doc, pageWidth, pageHeight, margin);

      // Convert to buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      resolve(pdfBuffer);
      
    } catch (error) {
      console.error('Error preparing PDF data:', error);
      reject(error);
    }
  });
};

/**
 * Add details section to PDF
 */
async function addDetailsSection(doc, patient, doctor, hospital, margin, yPosition, contentWidth) {
  const boxWidth = (contentWidth - 10) / 2;
  const boxHeight = 65;

  // Subject Details Box
  doc.setFillColor(255, 240, 245); // Light pink background
  doc.rect(margin, yPosition, boxWidth, boxHeight, 'F');
  
  // Subject Details Header
  doc.setFillColor(0, 0, 0); // Black header
  doc.rect(margin, yPosition, boxWidth, 12, 'F');
  
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Subject Details', margin + 5, yPosition + 8);

  // Subject Details Content
  doc.setTextColor(0, 0, 0); // Black text
  doc.setFontSize(10);
  let detailY = yPosition + 20;
  const lineHeight = 7;

  const subjectDetails = [
    `Name: ${patient?.firstName || 'Unknown'} ${patient?.lastName || ''}`,
    `Address: ${patient?.address || 'Not specified'}`,
    `Contact: ${patient?.contact || 'Not provided'}`,
    `Gender: ${patient?.gender || 'Not specified'}`,
    `Age: ${patient?.age || 'N/A'} Years`,
    `Weight: ${patient?.weight || 'N/A'} kg`,
    `Height: ${patient?.height || 'N/A'}`
  ];

  subjectDetails.forEach(detail => {
    doc.text(detail, margin + 5, detailY);
    detailY += lineHeight;
  });

  // Examiner Details Box
  const examinerX = margin + boxWidth + 10;
  doc.setFillColor(255, 240, 245); // Light pink background
  doc.rect(examinerX, yPosition, boxWidth, boxHeight, 'F');
  
  // Examiner Details Header
  doc.setFillColor(0, 0, 0); // Black header
  doc.rect(examinerX, yPosition, boxWidth, 12, 'F');
  
  doc.setTextColor(255, 255, 255); // White text
  doc.setFontSize(12);
  doc.text('Examiner Details', examinerX + 5, yPosition + 8);

  // Examiner Details Content
  doc.setTextColor(0, 0, 0); // Black text
  doc.setFontSize(10);
  detailY = yPosition + 20;

  const examinerDetails = [
    `Hospital Name: ${hospital?.name || 'Unknown Hospital'}`,
    `Hospital Address: ${hospital?.address || 'Address not provided'}`,
    `Doctor Name: ${doctor?.name || (doctor?.firstName && doctor?.lastName ? `${doctor.firstName} ${doctor.lastName}` : 'Unknown Doctor')}`,
    `Designation: ${doctor?.specialization || 'General Practitioner'}`,
    `Screening Place: ${hospital?.name || 'Unknown Hospital'}`
  ];

  examinerDetails.forEach(detail => {
    doc.text(detail, examinerX + 5, detailY);
    detailY += lineHeight;
  });
}

/**
 * Add breast screening section to PDF
 */
async function addBreastScreeningSection(doc, title, topImage, centerImage, bottomImage, breastIcon, margin, yPosition, contentWidth) {
  // Section header with breast icon
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 182, 193);
  doc.setLineWidth(1);
  doc.roundedRect(margin + 50, yPosition, 120, 15, 7, 7, 'FD');

  // Add breast icon
  if (breastIcon) {
    const iconBuffer = Buffer.from(breastIcon.split(',')[1], 'base64');
    doc.addImage(breastIcon, 'SVG', margin + 55, yPosition + 2, 10, 10);
  }

  // Section title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, margin + 70, yPosition + 10);

  yPosition += 25;

  // Images grid
  const imageWidth = 35;
  const imageHeight = 35;
  const imageSpacing = (contentWidth - (imageWidth * 3)) / 2;

  const images = [
    { img: topImage, label: 'I. Top Side Image' },
    { img: centerImage, label: 'II. Left Side Image' },
    { img: bottomImage, label: 'III. Right Side Image' }
  ];

  let xPosition = margin;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    
    // Image label
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const labelWidth = doc.getTextWidth(image.label);
    doc.text(image.label, xPosition + (imageWidth - labelWidth) / 2, yPosition);

    // Image container border
    doc.setDrawColor(221, 221, 221);
    doc.setLineWidth(0.5);
    doc.rect(xPosition, yPosition + 5, imageWidth, imageHeight);

    // Add image
    if (image.img) {
      try {
        doc.addImage(image.img, 'JPEG', xPosition + 1, yPosition + 6, imageWidth - 2, imageHeight - 2);
      } catch (error) {
        // If image fails to load, add placeholder text
        doc.setFontSize(8);
        doc.text('Image\nMissing', xPosition + imageWidth/2 - 8, yPosition + imageHeight/2);
      }
    }

    xPosition += imageWidth + imageSpacing;
  }

  return yPosition + imageHeight + 15;
}

/**
 * Add footer to PDF
 */
async function addFooter(doc, pageWidth, pageHeight, margin) {
  const footerY = pageHeight - 35;
  const footerHeight = 20;

  // Footer background
  doc.setFillColor(255, 240, 245);
  doc.rect(margin, footerY, pageWidth - (margin * 2), footerHeight, 'F');

  // Disclaimer
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Disclaimer:', margin + 5, footerY + 8);
  
  doc.setFont('helvetica', 'normal');
  const disclaimerText = 'The Breast screening report we provide is based on what we can see in the images. It might change over time, depending on how the pictures are taken and how well we can see.';
  const splitDisclaimer = doc.splitTextToSize(disclaimerText, 120);
  doc.text(splitDisclaimer, margin + 25, footerY + 8);

  // Powered by section
  doc.setFontSize(9);
  doc.text('Powered By', pageWidth - margin - 60, footerY + 8);

  // Add logos
  try {
    // Azure logo
    const azureLogoResponse = await axios.get('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLDJHCPEwjND1n8zRkZij43mASb-r5NFAh5A&s', { responseType: 'arraybuffer' });
    const azureLogoBuffer = await sharp(azureLogoResponse.data)
      .resize(15, 10, { fit: 'contain' })
      .png()
      .toBuffer();
    const azureLogoDataUrl = `data:image/png;base64,${azureLogoBuffer.toString('base64')}`;
    doc.addImage(azureLogoDataUrl, 'PNG', pageWidth - margin - 40, footerY + 3, 15, 10);

    // D3S logo
    const d3sLogoResponse = await axios.get('https://static.wixstatic.com/media/048d7e_644b43b18e8347d6b2b4c65943725115~mv2.png/v1/fill/w_554,h_166,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/D3S%20Healthcare%20Logo.png', { responseType: 'arraybuffer' });
    const d3sLogoBuffer = await sharp(d3sLogoResponse.data)
      .resize(20, 10, { fit: 'contain' })
      .png()
      .toBuffer();
    const d3sLogoDataUrl = `data:image/png;base64,${d3sLogoBuffer.toString('base64')}`;
    doc.addImage(d3sLogoDataUrl, 'PNG', pageWidth - margin - 20, footerY + 3, 20, 10);
  } catch (error) {
    console.warn('Could not load footer logos');
  }
}

/**
 * Process all images
 * @param {Object} images - Object containing image URLs
 * @returns {Promise<Object>} - Processed images as data URLs
 */
async function processImages(images) {
  if (!images) return {};
  
  // Process each image key
  const imageKeys = [
    'leftTopImage', 'leftCenterImage', 'leftBottomImage',
    'rightTopImage', 'rightCenterImage', 'rightBottomImage'
  ];
  
  const processedImages = {};
  
  // Process all images in parallel
  await Promise.all(imageKeys.map(async (key) => {
    if (images[key]) {
      try {
        // Add logging to debug image URLs
        console.log(`Processing image ${key}: ${images[key]}`);
        
        const dataUrl = await fetchAndProcessImage(images[key]);
        processedImages[key] = dataUrl;
        
        // Verify data URL was created successfully
        console.log(`Image ${key} processed successfully: ${dataUrl.substring(0, 50)}...`);
      } catch (error) {
        console.error(`Error processing ${key}:`, error.message);
        // Create a more descriptive placeholder with the error
        processedImages[key] = createPlaceholderImage(`${key} - Error: ${error.message.substring(0, 30)}`);
      }
    } else {
      console.warn(`Image ${key} not provided`);
      processedImages[key] = createPlaceholderImage(`${key} Missing`);
    }
  }));
  
  return processedImages;
}

/**
 * Create a placeholder image for missing images
 * @param {string} text - Text to display in the placeholder
 * @returns {string} - Data URL of the placeholder image
 */
function createPlaceholderImage(text) {
  // Create a more visually distinct SVG placeholder
  const svgText = text.replace(/([A-Z])/g, ' $1').trim();
  const svgPlaceholder = `
    <svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" viewBox="0 0 130 130">
      <rect width="100%" height="100%" fill="#f0f0f0" stroke="#cccccc" stroke-width="2"/>
      <rect x="10" y="10" width="110" height="110" fill="#ffffff" stroke="#dddddd" stroke-width="1" stroke-dasharray="5,5"/>
      <text x="50%" y="40%" font-family="Arial" font-size="14" fill="#888888" text-anchor="middle" dominant-baseline="middle">Image Missing</text>
      <text x="50%" y="60%" font-family="Arial" font-size="12" fill="#888888" text-anchor="middle" dominant-baseline="middle">${svgText}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svgPlaceholder).toString('base64')}`;
}

/**
 * Fetch and process an image from URL
 * @param {string} imageUrl - URL of the image
 * @returns {Promise<string>} - Data URL of the processed image
 */
async function fetchAndProcessImage(imageUrl) {
  try {
    // Add timeout and retry logic for better reliability
    const maxRetries = 3;
    let attempt = 0;
    let error;
    
    while (attempt < maxRetries) {
      try {
        const response = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 10000, // 10 second timeout
          headers: {
            'Accept': 'image/*'
          }
        });
        
        // Check if we got a valid image
        if (!response.data || response.data.length === 0) {
          throw new Error('Empty response received');
        }
        
        // Process the image with sharp
        const buffer = await sharp(response.data)
          .resize({
            width: 130, 
            height: 130, 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 90 })
          .toBuffer();
        
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
      } catch (err) {
        error = err;
        console.warn(`Attempt ${attempt + 1} failed: ${err.message}`);
        attempt++;
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw error || new Error('Failed to fetch image after multiple attempts');
  } catch (error) {
    console.error(`Failed to process image from URL ${imageUrl}: ${error.message}`);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

/**
 * Get SVG breast icon
 * @returns {Promise<string>} - Data URL of breast icon
 */
async function getBreastIcon() {
  const svgIcon = `
    <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="16" fill="#FFB6C1" stroke="#FF69B4" stroke-width="1"/>
      <circle cx="20" cy="20" r="4" fill="#FF69B4"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svgIcon).toString('base64')}`;
}

/**
 * Get hospital logo
 * @param {string} imageUrl - URL of the hospital logo
 * @returns {Promise<string>} - Data URL of hospital logo
 */
async function getHospitalLogo(imageUrl) {
  try {
    const width = 80;
    const height = 80;

    if (!imageUrl) {
      // Default hospital logo (SVG)
      const svgLogo = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${width}" height="${height}" fill="#f3f4f6"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#374151" text-anchor="middle" dominant-baseline="middle">H</text>
        </svg>
      `;
      return `data:image/svg+xml;base64,${Buffer.from(svgLogo).toString('base64')}`;
    }

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = await sharp(response.data)
      .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error fetching hospital logo:', error.message);

    // Fallback SVG logo
    const fallbackSvg = `
      <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="#f3f4f6"/>
        <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#374151" text-anchor="middle" dominant-baseline="middle">H</text>
      </svg>
    `;
    return `data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString('base64')}`;
  }
}

/**
 * Get AWS logo
 * @returns {Promise<string>} - Data URL of AWS logo
 */
async function getAWSLogo() {
  const svgLogo = `
    <svg width="25" height="25" xmlns="http://www.w3.org/2000/svg">
      <rect width="25" height="25" fill="white"/>
      <text x="50%" y="60%" font-family="Arial" font-weight="bold" font-size="10" fill="#232F3E" text-anchor="middle">AWS</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svgLogo).toString('base64')}`;
}

/**
 * Format date
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm} UTC`;
}

// Export functions
module.exports = { 
  generateBreastCancerReport,
  formatDate
};