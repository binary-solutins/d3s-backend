const { Doctor, Hospital, Patient, Report } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// ➕ Create Doctor (Only Hospital or Admin can create doctor account)
exports.createDoctor = async (req, res) => {
  try {
    const { name, email, password, specialization, designation, hospitalId } = req.body;
    const authHospitalId = req.hospitalId; // From auth middleware
    const userRole = req.role; // From auth middleware

    // Only hospitals and admins can create doctors
    if (userRole !== 'hospital' && userRole !== 'admin') {
      return res.status(403).json({ 
        error: '❌ Only hospitals and admins can create doctor accounts' 
      });
    }

    // Determine target hospital ID
    let targetHospitalId;
    
    if (userRole === 'hospital') {
      // Hospitals can only create doctors for their own hospital
      targetHospitalId = authHospitalId;
      if (!targetHospitalId) {
        return res.status(400).json({ error: '❌ Hospital ID not found in token' });
      }
    } else if (userRole === 'admin') {
      // Admins can create doctors for any hospital, but hospitalId must be provided
      if (!hospitalId) {
        return res.status(400).json({ error: '❌ Hospital ID is required' });
      }
      targetHospitalId = hospitalId;
    }

    // Validate hospital exists
    const hospital = await Hospital.findByPk(targetHospitalId);
    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }

    // Validate required fields (name and specialization are required, email and password are optional)
    if (!name || !specialization) {
      return res.status(400).json({ 
        error: '❌ Missing required fields: name and specialization are required' 
      });
    }

    // Handle email - if not provided, set to null
    let doctorEmail = email ? email.trim() : null;
    if (doctorEmail) {
      // Validate email format if provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(doctorEmail)) {
        return res.status(400).json({ error: '❌ Invalid email format' });
      }
      
      // Check if email already exists
      const existingDoctor = await Doctor.findOne({ 
        where: { 
          email: doctorEmail
        } 
      });
      if (existingDoctor) {
        return res.status(400).json({ error: '❌ Doctor with this email already exists' });
      }
    }

    // Handle password - if not provided, set to null
    let hashedPassword = null;
    if (password) {
      // Validate password strength (minimum 6 characters) if provided
      if (password.length < 6) {
        return res.status(400).json({ error: '❌ Password must be at least 6 characters long' });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create doctor
    const doctor = await Doctor.create({ 
      name, 
      email: doctorEmail, 
      password: hashedPassword,
      specialization, 
      designation: designation || null, 
      hospitalId: targetHospitalId,
      isActive: true
    });
    
    // Remove password from response
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.password;
    
    res.status(201).json({
      message: '✅ Doctor account created successfully',
      doctor: {
        ...doctorResponse,
        hospital: {
          id: hospital.id,
          name: hospital.name
        }
      },
      ...(email || password ? {} : {
        note: 'Email and password can be added later using the update endpoint.'
      })
    });
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔐 Doctor Login (Public endpoint - no authentication required)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: '❌ Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '❌ Invalid email format' });
    }
    
    // Find doctor with hospital information
    const doctor = await Doctor.findOne({ 
      where: { email },
      include: [{ 
        model: Hospital, 
        as: 'hospital',
        attributes: ['id', 'name', 'isVerified']
      }]
    });

    // Check if doctor exists
    if (!doctor) {
      return res.status(401).json({ error: '❌ Invalid email or password' });
    }

    // Check if doctor has email and password set
    if (!doctor.email || !doctor.password) {
      return res.status(401).json({ 
        error: '❌ Doctor account does not have email/password set. Please contact your hospital administrator to set up your account.' 
      });
    }

    // Check if password is correct
    const isPasswordValid = await bcrypt.compare(password, doctor.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '❌ Invalid email or password' });
    }

    // Check if doctor is active
    if (!doctor.isActive) {
      return res.status(401).json({ 
        error: '❌ Doctor account is deactivated. Please contact your hospital administrator.' 
      });
    }

    // Check if hospital is verified
    if (doctor.hospital && !doctor.hospital.isVerified) {
      return res.status(401).json({ 
        error: '❌ Hospital account is not verified. Please contact the hospital administrator.' 
      });
    }

    // Generate JWT token (never expires)
    const token = jwt.sign(
      { 
        id: doctor.id, 
        role: 'doctor' 
      }, 
      process.env.JWT_SECRET
    );
    
    // Remove password from response
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.password;
    
    res.status(200).json({ 
      token, 
      message: '✅ Login successful',
      user: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
        designation: doctor.designation,
        hospitalId: doctor.hospitalId,
        hospital: doctor.hospital ? {
          id: doctor.hospital.id,
          name: doctor.hospital.name,
          isVerified: doctor.hospital.isVerified
        } : null,
        isActive: doctor.isActive,
        role: 'doctor'
      },
      role: 'doctor'
    });
  } catch (error) {
    console.error('Doctor login error:', error);
    res.status(500).json({ error: '❌ An error occurred during login. Please try again.' });
  }
};

// 🏥 Get Doctors by Hospital
exports.getDoctorsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    // First check if hospital exists and get verification status
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }

    const doctors = await Doctor.findAll({
      where: { hospitalId },
    });

    if (!doctors.length) {
      return res.status(200).json({ 
        doctors: [], 
        message: '❌ No doctors found for this hospital',
        isHospitalVerified: hospital.isVerified
      });
    }

    res.status(200).json({
      doctors: doctors.map(doctor => doctor.toJSON()),
      isHospitalVerified: hospital.isVerified
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Get Doctor by ID
exports.getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.hospitalId;
    
    const whereClause = { id };
    // Filter by hospitalId if user is a hospital
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const doctor = await Doctor.findOne({
      where: whereClause
    });
    

    if (!doctor) return res.status(404).json({ error: '❌ Doctor not found' });

    res.status(200).json(doctor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✏️ Update Doctor
exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, specialization, designation } = req.body;
    const hospitalId = req.hospitalId;
    const userRole = req.role;
    const doctorId = req.doctorId; // From auth middleware if doctor is updating themselves
    
    const whereClause = { id };
    // Filter by hospitalId if user is a hospital
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }
    // If doctor is updating themselves, ensure they can only update their own profile
    if (userRole === 'doctor' && doctorId) {
      whereClause.id = doctorId;
    }

    const doctor = await Doctor.findOne({ where: whereClause });
    if (!doctor) return res.status(404).json({ error: '❌ Doctor not found' });

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (specialization) updateData.specialization = specialization;
    if (designation !== undefined) updateData.designation = designation;

    // Handle email update
    if (email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: '❌ Invalid email format' });
      }
      
      // Check if email already exists (excluding current doctor)
      const existingDoctor = await Doctor.findOne({ 
        where: { 
          email,
          id: { [Op.ne]: id }
        } 
      });
      if (existingDoctor) {
        return res.status(400).json({ error: '❌ Doctor with this email already exists' });
      }
      
      updateData.email = email;
    }

    // Handle password update
    if (password) {
      // Validate password strength (minimum 6 characters)
      if (password.length < 6) {
        return res.status(400).json({ error: '❌ Password must be at least 6 characters long' });
      }
      // Hash the new password
      updateData.password = await bcrypt.hash(password, 10);
    }

    await doctor.update(updateData);
    
    // Remove password from response
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.password;
    
    res.status(200).json({
      message: '✅ Doctor updated successfully',
      doctor: doctorResponse
    });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🗑️ Delete Doctor
exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const hospitalId = req.hospitalId;
    
    const whereClause = { id };
    // Filter by hospitalId if user is a hospital
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const doctor = await Doctor.findOne({ where: whereClause });
    if (!doctor) return res.status(404).json({ error: '❌ Doctor not found' });

    await doctor.destroy();
    res.status(200).json({ message: '✅ Doctor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔎 Search Doctor by name/specialization
exports.searchDoctors = async (req, res) => {
  try {
    const { query } = req.query;
    
    // Filter by hospitalId if user is a hospital
    const hospitalId = req.hospitalId;
    const whereClause = {
      [Op.or]: [
        { name: { [Op.like]: `%${query}%` } },
        { specialization: { [Op.like]: `%${query}%` } },
        { designation: { [Op.like]: `%${query}%` } }
      ]
    };
    
    // Add hospital filter if user is a hospital
    if (hospitalId) {
      whereClause.hospitalId = hospitalId;
    }

    const doctors = await Doctor.findAll({
      where: whereClause,
      include: [Hospital]
    });

    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 📋 Get Assigned Reports for Doctor
exports.getAssignedReports = async (req, res) => {
  try {
    const doctorId = req.doctorId; // From auth middleware
    const userRole = req.role;

    // Only doctors can access this endpoint
    if (userRole !== 'doctor' || !doctorId) {
      return res.status(403).json({ 
        error: '❌ Only doctors can access their assigned reports' 
      });
    }

    // Get query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const { reportType, isChecked, startDate, endDate, query } = req.query;

    // Build where clause
    const whereClause = {
      assignedDoctorId: doctorId,
      isDeleted: false
    };

    // Add filters
    if (reportType) {
      whereClause.reportType = reportType;
    }

    if (isChecked !== undefined) {
      whereClause.isChecked = isChecked === 'true' || isChecked === true;
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.assignedAt = {};
      if (startDate) whereClause.assignedAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.assignedAt[Op.lte] = new Date(endDate);
    }

    // Text search filter
    if (query) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${query}%` } },
        { description: { [Op.like]: `%${query}%` } },
        { fileName: { [Op.like]: `%${query}%` } }
      ];
    }

    // Fetch reports with pagination
    const { count, rows: reports } = await Report.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'firstName', 'lastName', 'gender', 'age', 'contact', 'email', 'address']
        },
        {
          model: Hospital,
          as: 'hospital',
          attributes: ['id', 'name', 'address', 'phone', 'city', 'state', 'country']
        },
        {
          model: Doctor,
          as: 'doctor',
          attributes: ['id', 'name', 'specialization', 'designation', 'email']
        }
      ],
      order: [['assignedAt', 'DESC']],
      limit: pageSize,
      offset: offset
    });

    res.status(200).json({
      message: '✅ Assigned reports retrieved successfully',
      count: count,
      page: page,
      pageSize: pageSize,
      totalPages: Math.ceil(count / pageSize),
      reports: reports
    });
  } catch (error) {
    console.error('Error fetching assigned reports:', error);
    res.status(500).json({ error: error.message });
  }
};

// 📄 Proxy PDF from Azure Blob Storage (to avoid CORS errors)
exports.proxyPdf = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'PDF URL is required' });
    }

    console.log('📥 Fetching PDF from Azure:', url);
    
    // Fetch from Azure - NO Authorization header needed
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024, // 100MB limit
      maxBodyLength: 100 * 1024 * 1024,
    });
    
    console.log('✅ PDF fetched, size:', response.data.length, 'bytes');
    
    // Return PDF to frontend
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': response.data.length,
    });
    
    res.send(Buffer.from(response.data));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch PDF',
      error: error.message 
    });
  }
};
