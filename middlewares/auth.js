// middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../models');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Support admin, hospital, and doctor roles
    if (decoded.role === 'admin') {
      const admin = await db.Admin.findByPk(decoded.id);
      if (!admin) throw new Error('Admin not found');
      
      req.user = admin;
      req.userType = 'admin';
      req.role = 'admin';
      req.admin = admin; // Keep for backward compatibility
    } else if (decoded.role === 'hospital') {
      const hospital = await db.Hospital.findByPk(decoded.id);
      if (!hospital) throw new Error('Hospital not found');
      
      req.user = hospital;
      req.userType = 'hospital';
      req.role = 'hospital';
      req.hospitalId = hospital.id;
      req.hospital = hospital; // Keep for backward compatibility
    } else if (decoded.role === 'doctor') {
      const doctor = await db.Doctor.findByPk(decoded.id);
      if (!doctor) throw new Error('Doctor not found');
      
      req.user = doctor;
      req.userType = 'doctor';
      req.role = 'doctor';
      req.doctorId = doctor.id;
      req.hospitalId = doctor.hospitalId; // Doctor belongs to a hospital
      req.doctor = doctor; // Keep for backward compatibility
    } else {
      // Legacy support: if no role, assume it's a hospital (for backward compatibility)
      const hospital = await db.Hospital.findByPk(decoded.id);
      if (hospital) {
        req.user = hospital;
        req.userType = 'hospital';
        req.role = 'hospital';
        req.hospitalId = hospital.id;
        req.hospital = hospital;
      } else {
        throw new Error('Invalid token or user not found');
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};