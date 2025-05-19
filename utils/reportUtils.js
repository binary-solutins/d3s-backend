const { Storage } = require('@google-cloud/storage');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const pdf = require('html-pdf');
const handlebars = require('handlebars');

// Helper functions
const getMonthName = (monthIndex) => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[monthIndex];
};

const formatTime = (date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Image processing functions
const fetchLogo = async () => {
  try {
    const logoPath = path.join(__dirname, '../uploads/logo.svg');
    return await sharp(logoPath)
      .resize(100, 40)
      .png()
      .toBuffer();
  } catch (error) {
    const svgLogo = `
      <svg width="100" height="40" xmlns="http://www.w3.org/2000/svg">
        <text x="10" y="25" font-family="Arial" font-size="20">BR-<tspan fill="#ff6699">Scan</tspan></text>
      </svg>
    `;
    return sharp(Buffer.from(svgLogo))
      .resize(100, 40)
      .png()
      .toBuffer();
  }
};

const fetchHospitalLogo = async (imageUrl) => {
  try {
    if (!imageUrl) {
      const svgLogo = `
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#4CAF50"/>
          <circle cx="50" cy="50" r="35" fill="white"/>
          <text x="35" y="45" font-family="Arial" font-size="20" fill="#FF4500">GH</text>
          <text x="25" y="65" font-family="Arial" font-size="10" fill="#FF4500">MEHSANA</text>
        </svg>
      `;
      return sharp(Buffer.from(svgLogo))
        .resize(40, 40)
        .png()
        .toBuffer();
    }

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return sharp(response.data)
      .resize(40, 40)
      .png()
      .toBuffer();
  } catch (error) {
    const placeholderSvg = `
      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" fill="#f0f0f0"/>
        <text x="5" y="23" font-family="Arial" font-size="12" fill="#888">Logo</text>
      </svg>
    `;
    return sharp(Buffer.from(placeholderSvg))
      .resize(40, 40)
      .png()
      .toBuffer();
  }
};

const fetchAWSLogo = async () => {
  try {
    const svgLogo = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="white"/>
        <text x="15" y="60" font-family="Arial" font-weight="bold" font-size="20" fill="#232F3E">AWS</text>
      </svg>
    `;
    return sharp(Buffer.from(svgLogo))
      .resize(25, 25)
      .png()
      .toBuffer();
  } catch (error) {
    return sharp(Buffer.from([])).toBuffer();
  }
};

/**
 * Generate breast cancer report PDF using html-pdf
 */
exports.generateBreastCancerReport = async (uploadedImages, patient, doctor, hospital, title) => {
  try {
    // Load HTML template
    const templatePath = path.join(__dirname, './breast_cancer_report.html');
    const htmlContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(htmlContent);

    // Process all images in parallel
    const imageProcessingPromises = uploadedImages.map(async (img) => {
      try {
        const response = await axios.get(img.fileUrl, { responseType: 'arraybuffer' });
        const buffer = await sharp(response.data)
          .resize(130, 130)
          .jpeg({ quality: 90 })
          .toBuffer();
        return { field: img.fieldName, data: buffer };
      } catch (error) {
        console.error(`Error processing ${img.fieldName}:`, error.message);
        return { field: img.fieldName, data: null };
      }
    });

    const processedImages = await Promise.all(imageProcessingPromises);
    const imageFields = processedImages.reduce((acc, cur) => {
      if (cur.data) {
        acc[cur.field] = `data:image/jpeg;base64,${cur.data.toString('base64')}`;
      }
      return acc;
    }, {});

    // Process logos
    const [brScanLogo, hospitalLogo, awsLogo] = await Promise.all([
      fetchLogo(),
      fetchHospitalLogo(hospital.imageUrl),
      fetchAWSLogo()
    ]);

    // Prepare template data
    const currentDate = new Date();
    const templateData = {
      title,
      date: `${currentDate.getDate()} ${getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}, ${formatTime(currentDate)}`,
      patient: {
        ...patient,
        address: patient.address || 'Not specified',
        contact: patient.contact || 'Not provided',
        gender: patient.gender || 'Not specified',
        age: patient.age || 'N/A',
        weight: patient.weight || 'N/A',
        height: patient.height || 'N/A'
      },
      doctor: {
        ...doctor,
        firstName: doctor.firstName || 'Unknown',
        lastName: doctor.lastName || 'Doctor',
        specialization: doctor.specialization || 'General Practitioner'
      },
      hospital: {
        ...hospital,
        name: hospital.name || 'Unknown Hospital',
        address: hospital.address || 'Address not provided'
      },
      brScanLogo: `data:image/png;base64,${brScanLogo.toString('base64')}`,
      hospitalLogo: `data:image/png;base64,${hospitalLogo.toString('base64')}`,
      awsLogo: `data:image/png;base64,${awsLogo.toString('base64')}`,
      ...imageFields
    };

    // Generate PDF
    const html = template(templateData);
    
    // Fixed PDF options for proper layout
    const pdfOptions = {
      format: 'A4',
      orientation: 'portrait',
      border: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      // Improved rendering options
      base: `file://${process.cwd()}/`, // Important for resolving paths
      zoomFactor: 1,
      phantomArgs: ['--web-security=false', '--local-url-access=false'],
      timeout: 30000,
      // Force evaluation of CSS media type as 'screen' rather than 'print'
      // This helps with flex layouts
      renderDelay: 1000, // Give time for all resources to render
      httpHeaders: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    };

    return new Promise((resolve, reject) => {
      pdf.create(html, pdfOptions).toBuffer((err, buffer) => {
        if (err) {
          console.error('PDF generation error:', err);
          return reject(new Error('Failed to generate PDF'));
        }
        resolve(buffer);
      });
    });
  } catch (error) {
    console.error('Error in generateBreastCancerReport:', error);
    throw new Error(`Report generation failed: ${error.message}`);
  }
};