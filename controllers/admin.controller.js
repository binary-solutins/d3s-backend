// controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const Admin = db.Admin;
const Hospital = db.Hospital;
const sendEmail = require('../utils/emainSender');

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword
    });

    const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET);
    res.status(201).json({ token, admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ where: { email } });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET);
    res.json({ token, admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ where: { email } });
    
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const resetToken = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour
    
    await admin.update({ resetToken, resetTokenExpiry });
    
    await sendEmail(email, 'Password Reset', `Reset token: ${resetToken}`);
    res.json({ message: 'Reset token sent to email' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const admin = await Admin.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [db.Sequelize.Op.gt]: Date.now() }
      }
    });

    if (!admin) return res.status(400).json({ error: 'Invalid or expired token' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await admin.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.findAll();
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateHospitalStatus = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { isVerified, plan_time } = req.body;
    
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    await hospital.update({ isVerified, plan_time });
    res.json({ message: 'Hospital updated successfully', hospital });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};