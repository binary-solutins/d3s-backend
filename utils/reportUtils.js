const fs = require('fs');
const path = require('path');
const htmlPdf = require('html-pdf-node');
const Handlebars = require('handlebars');
const sharp = require('sharp');
const axios = require('axios');

/**
 * Generate a PDF breast screening report using HTML template with dynamic data
 * @param {Object} reportData - The report data containing all information
 * @returns {Promise<Buffer>} - The generated PDF as a buffer
 */
const generateBreastCancerReport = async (reportData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Extract the data
      const { patient, doctor, hospital, images, title } = reportData;

      // Load the HTML template
      const templateHtml = getReportTemplate();

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
      
      // Prepare data for the template
      const templateData = {
        title: title || "BREAST SCREENING REPORT",
        date: formattedDate,
        
        // Patient details with fallbacks
        patient: {
          firstName: patient?.firstName || "Unknown",
          lastName: patient?.lastName || "",
          address: patient?.address || "Not specified",
          contact: patient?.contact || "Not provided",
          gender: patient?.gender || "Not specified",
          age: patient?.age || "N/A",
          weight: patient?.weight || "N/A",
          height: patient?.height || "N/A"
        },
        
        // Doctor details with fallbacks
        doctor: {
          name: doctor?.name || (doctor?.firstName && doctor?.lastName ? 
            `${doctor.firstName} ${doctor.lastName}` : "Unknown Doctor"),
          specialization: doctor?.specialization || "General Practitioner"
        },
        
        // Hospital details with fallbacks
        hospital: {
          name: hospital?.name || "Unknown Hospital",
          address: hospital?.address || "Address not provided"
        },
        
        // Images converted to data URLs
        breastIcon: breastIcon,
        hospitalLogo: hospitalLogo,
        awsLogo: awsLogo,
        
        // Breast images
        leftTopImage: processedImages.leftTopImage || createPlaceholderImage('Left Top'),
        leftCenterImage: processedImages.leftCenterImage || createPlaceholderImage('Left Center'),
        leftBottomImage: processedImages.leftBottomImage || createPlaceholderImage('Left Bottom'),
        rightTopImage: processedImages.rightTopImage || createPlaceholderImage('Right Top'),
        rightCenterImage: processedImages.rightCenterImage || createPlaceholderImage('Right Center'),
        rightBottomImage: processedImages.rightBottomImage || createPlaceholderImage('Right Bottom')
      };
      
      // Compile the template with Handlebars
      const template = Handlebars.compile(templateHtml);
      const html = template(templateData);
      
      const options = {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '5mm',
          right: '5mm',
          bottom: '5mm',
          left: '5mm'
        },
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        // Add these options for better single-page fitting
        width: '210mm',
        height: '297mm',
        timeout: 30000
      };
      
      
      
      // Generate PDF from HTML
      htmlPdf.generatePdf({ content: html }, options)
        .then(pdfBuffer => {
          resolve(pdfBuffer);
        })
        .catch(error => {
          console.error('Error generating PDF:', error);
          reject(error);
        });
      
    } catch (error) {
      console.error('Error preparing PDF data:', error);
      reject(error);
    }
  });
};

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

/**
 * Get the HTML template for the report - FIXED VERSION
 * @returns {string} - The HTML template string
 */
function getReportTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Breast Screening Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: A4;
            margin: 10mm;
        }

        body {
            font-family: 'Roboto', Arial, sans-serif;
            line-height: 1.3;
            color: #333;
            background-color: #f5f5f5;
            font-size: 11px;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
        }

        .container {
            width: 210mm; /* A4 width */
            min-height: 297mm; /* A4 height */
            max-width: 210mm;
            margin: 0 auto;
            padding: 8mm;
            border: 3px solid #FFB6C1;
            border-radius: 8px;
            box-sizing: border-box;
            background-color: #fff;
            box-shadow: 0 0 15px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            position: relative;
        }

        /* Header Section */
        .header {
            width: 100%;
            padding: 8px 15px;
            border-bottom: 1px solid #ddd;
            margin-bottom: 10px;
        }

        .header-inner {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            width: 20%;
        }

        .logo h2 {
            font-size: 20px;
            font-weight: 700;
            color: #000;
            margin: 0;
        }

        .scan-text {
            color: #ff4081;
        }

        .title {
            text-align: center;
            flex: 1;
        }

        .title h1 {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 3px;
            margin-top: 0;
        }

        .date {
            font-size: 12px;
            color: #555;
            margin: 0;
        }

        .hospital-logo {
            text-align: right;
            width: 20%;
        }

        .logo-container {
            width: 60px;
            height: 60px;
            display: inline-block;
        }

        .logo-container img {
            width: 100%;
            height: auto;
            max-height: 60px;
            object-fit: contain;
        }
        
        .main-logo {
            width: 20%;
        }

        .main-logo-container {
            width: 80px;
            height: 60px;
            display: flex;
            align-items: center;
        }

        .main-logo-container img {
            width: 100%;
            height: auto;
            max-height: 60px;
            object-fit: contain;
        }

        /* Details Section */
        .details-container {
            display: flex;
            justify-content: space-between;
            width: 100%;
            margin: 8px 0;
            padding: 0 15px;
            gap: 15px;
        }

        .details-box {
            width: 48%;
            background-color: #FFF0F5;
            border-radius: 5px;
            overflow: hidden;
        }

        .details-header {
            background-color: #000 !important;
            padding: 6px 10px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .details-header h3 {
            color: #fff !important;
            font-size: 13px;
            font-weight: 500;
            margin: 0;
        }

        .details-content {
            padding: 8px 10px;
        }

        .detail-row {
            margin-bottom: 4px;
            display: flex;
            flex-wrap: nowrap;
            font-size: 10px;
        }

        .detail-label {
            min-width: 80px;
            color: #555;
            font-weight: 500;
            display: inline-block;
        }

        .detail-value {
            color: #000;
            font-weight: 400;
            display: inline-block;
            flex: 1;
        }

        /* Screening Section */
        .screening-section {
            margin: 12px 0;
            padding: 0 15px;
            page-break-inside: avoid;
        }

        .screening-header {
            display: flex;
            align-items: center;
            background-color: #fff;
            border: 2px solid #FFB6C1;
            border-radius: 20px;
            padding: 4px 10px;
            margin-bottom: 8px;
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
        }

        .breast-icon {
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .breast-icon img {
            width: 100%;
            height: auto;
        }

        .screening-header h3 {
            margin: 0;
            padding-left: 8px;
            color: #000;
            font-size: 13px;
            font-weight: 500;
        }

        /* Images Grid */
        .images-grid {
            display: flex;
            justify-content: space-between;
            width: 100%;
            gap: 10px;
        }

        .image-column {
            width: 32%;
            text-align: center;
        }

        .image-column h4 {
            margin-bottom: 6px;
            font-size: 11px;
        }

        .image-container {
            width: 200px !important;
            height: 200px !important;
            display: inline-block;
            border: 1px solid #ddd;
            overflow: hidden;
            margin: 0 auto;
        }

        .image-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        /* Remarks Section */
        .remarks-section {
            padding: 8px 15px;
            margin: 50px 0;
            
        }

        .remarks-section p {
            font-weight: bold;
            margin-bottom: 5px;
            font-size: 11px;
        }

        .center {
            display: flex;
            margin-bottom: 10px;
            justify-content: center;
            align-items: center;
        }

        .remarks-line {
            height: 1px;
            background-color: #ddd;
            margin: 8px 0;
        }

        /* Footer Section - FIXED: Positioned at bottom */
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            background-color: #FFF0F5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            padding: 8px 15px;
           
            border-top: 1px solid #ddd;
        }

        .disclaimer {
            width: 70%;
            font-size: 9px;
            line-height: 1.2;
        }

        .disclaimer-title {
            font-weight: 700;
            color: #800020;
        }

        .powered-by {
            width: 25%;
            text-align: right;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            font-size: 9px;
        }

        .powered-by span {
            margin-right: 5px;
        }

        .powered-logos {
            display: inline-flex;
            align-items: center;
        }

        .powered-logos img {
            height: 20px;
            width: auto;
            margin-left: 5px;
        }

        /* Force background colors in print */
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }

        /* Additional pink border emphasis for PDF generation */
        @media print {
            body {
                background-color: #fff !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            
            .container {
                border: 4px solid #FFB6C1 !important;
                border-radius: 8px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-shadow: none !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: none !important;
                min-height: auto !important;
                padding: 5mm !important;
            }
            
            .screening-section {
                page-break-inside: avoid;
            }
        }

        /* For PDF generation tools */
        @media screen and (max-width: 1px) {
            body {
                background-color: #fff !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            
            .container {
                width: 100% !important;
                max-width: none !important;
                margin: 0 !important;
                box-shadow: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="header-inner">
               <div class="main-logo">
                    <div class="main-logo-container">
                        <img src="https://fra.cloud.appwrite.io/v1/storage/buckets/681a95120019afd4e319/files/685b238500142409a042/view?project=681a94cb0031df448ed3&" alt="Main Logo">
                    </div>
                </div>
                <div class="title">
                    <h1>{{title}}</h1>
                    <p class="date">{{date}}</p>
                </div>
                <div class="hospital-logo">
                    <div class="logo-container">
                        <img src="{{hospitalLogo}}" alt="Hospital Logo">
                    </div>
                </div>
            </div>
        </header>

        <div class="details-container">
            <div class="details-box">
                <div class="details-header">
                    <h3>Subject Details</h3>
                </div>
                <div class="details-content">
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">{{patient.firstName}} {{patient.lastName}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Address:</div>
                        <div class="detail-value">{{patient.address}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Contact:</div>
                        <div class="detail-value">{{patient.contact}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Gender:</div>
                        <div class="detail-value">{{patient.gender}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Age:</div>
                        <div class="detail-value">{{patient.age}} Years</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Weight:</div>
                        <div class="detail-value">{{patient.weight}} kg</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Height:</div>
                        <div class="detail-value">{{patient.height}}</div>
                    </div>
                </div>
            </div>

            <div class="details-box">
                <div class="details-header">
                    <h3>Examiner Details</h3>
                </div>
                <div class="details-content">
                    <div class="detail-row">
                        <div class="detail-label">Hospital Name:</div>
                        <div class="detail-value">{{hospital.name}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Hospital Address:</div>
                        <div class="detail-value">{{hospital.address}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Doctor Name:</div>
                        <div class="detail-value">{{doctor.name}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Designation:</div>
                        <div class="detail-value">{{doctor.specialization}}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Screening Place:</div>
                        <div class="detail-value">{{hospital.name}}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="screening-section">
          <div class="center">
            <div class="screening-header">
                <div class="breast-icon">
                    <img src="{{breastIcon}}" alt="Breast Icon">
                </div>
                <h3>Left Breast Screening Visuals</h3>
            </div>
            </div>
            <div class="images-grid">
                <div class="image-column">
                    <h4>I. Top Side Image</h4>
                    <div class="image-container">
                        <img src="{{leftTopImage}}" alt="Left Breast Top Side">
                    </div>
                </div>
                <div class="image-column">
                    <h4>II. Left Side Image</h4>
                    <div class="image-container">
                        <img src="{{leftCenterImage}}" alt="Left Breast Left Side">
                    </div>
                </div>
                <div class="image-column">
                    <h4>III. Right Side Image</h4>
                    <div class="image-container">
                        <img src="{{leftBottomImage}}" alt="Left Breast Right Side">
                    </div>
                </div>
            </div>
        </div>

        <div class="screening-section">
            <div class="center">
            <div class="screening-header">
                <div class="breast-icon">
                    <img src="{{breastIcon}}" alt="Breast Icon">
                </div>
                <h3>Right Breast Screening Visuals</h3>
            </div>
            </div>
            <div class="images-grid">
                <div class="image-column">
                    <h4>I. Top Side Image</h4>
                    <div class="image-container">
                        <img src="{{rightTopImage}}" alt="Right Breast Top Side">
                    </div>
                </div>
                <div class="image-column">
                    <h4>II. Left Side Image</h4>
                    <div class="image-container">
                        <img src="{{rightCenterImage}}" alt="Right Breast Left Side">
                    </div>
                </div>
                <div class="image-column">
                    <h4>III. Right Side Image</h4>
                    <div class="image-container">
                        <img src="{{rightBottomImage}}" alt="Right Breast Right Side">
                    </div>
                </div>
            </div>
        </div>

        <div class="remarks-section">
            <p>Remarks:</p>
            <div class="remarks-line"></div>
            <div class="remarks-line"></div>
        </div>

        <footer class="footer">
            <div class="disclaimer">
                <span class="disclaimer-title">Disclaimer:</span> The Breast screening report we provide is based on what we can see in the images. It
                might change over time, depending on how the pictures are taken and how well we can see.
            </div>
            <div class="powered-by">
                <span>Powered By</span>
                <div class="powered-logos">
                    <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLDJHCPEwjND1n8zRkZij43mASb-r5NFAh5A&s" alt="azure">
                    <img src="https://static.wixstatic.com/media/048d7e_644b43b18e8347d6b2b4c65943725115~mv2.png/v1/fill/w_554,h_166,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/D3S%20Healthcare%20Logo.png" alt="d3s">
                </div>
            </div>
        </footer>
    </div>
</body>
</html>`;
}



// Export functions
module.exports = { 
  generateBreastCancerReport,
  formatDate,
  getReportTemplate
};