// controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const Admin = db.Admin;
const Hospital = db.Hospital;
const Doctor = db.Doctor;
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
    
    // First check if it's an admin
    const admin = await Admin.findOne({ where: { email } });
    
    if (admin && await bcrypt.compare(password, admin.password)) {
      // Admin login successful
      const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET);
      return res.json({ 
        token, 
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: 'admin'
        },
        role: 'admin'
      });
    }
    
    // If not admin, check if it's a hospital
    const hospital = await Hospital.findOne({ where: { email } });
    
    if (hospital && await bcrypt.compare(password, hospital.password)) {
      // Check if hospital is verified
      if (!hospital.isVerified) {
        return res.status(401).json({ error: '❌ Email not verified by the admin.' });
      }
      
      // Check if subscription is expired
      if (hospital.plan_time && new Date() > hospital.plan_time) {
        await hospital.update({ isVerified: false });
        return res.status(401).json({ error: '❌ Subscription expired' });
      }
      
      // Hospital login successful
      const token = jwt.sign({ id: hospital.id, role: 'hospital' }, process.env.JWT_SECRET);
      return res.json({ 
        token, 
        user: {
          id: hospital.id,
          name: hospital.name,
          email: hospital.email,
          phone: hospital.phone,
          imageUrl: hospital.imageUrl,
          role: 'hospital'
        },
        role: 'hospital',
        message: '✅ Login successful'
      });
    }
    
    // If neither admin nor hospital found, or password incorrect
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    let user = await Admin.findOne({ where: { email } });
    let userType = 'admin';

    if (!user) {
      user = await Hospital.findOne({ where: { email } });
      userType = 'hospital';
    }

    if (!user) {
      user = await Doctor.findOne({ where: { email } });
      userType = 'doctor';
    }
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resetToken = jwt.sign({ id: user.id, type: userType }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour
    
    await user.update({ resetToken, resetTokenExpiry });
    
    let resetUrl = '';
    if (userType === 'doctor') {
      resetUrl = `https://doctor.d3shealthcare.com/reset-password?token=${resetToken}`;
    } else {
      resetUrl = `https://admin.d3shealthcare.com/reset-password?token=${resetToken}`;
    }

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1a73e8; margin: 0; font-size: 28px;">D3S Healthcare</h1>
          <p style="color: #5f6368; font-size: 14px;">Hospital-Doctor-Patient Management System</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin-bottom: 25px;" />
        <p style="font-size: 16px; color: #3c4043;">Hello,</p>
        <p style="font-size: 16px; color: #3c4043; line-height: 1.5;">
          We received a request to reset the password for your <strong>${userType.toUpperCase()}</strong> account. 
          If you didn't make this request, you can safely ignore this email.
        </p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${resetUrl}" style="background-color: #1a73e8; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.3s;">Reset Your Password</a>
        </div>
        <p style="font-size: 14px; color: #5f6368; background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #1a73e8;">
          <strong>Security Note:</strong> This link will expire in 1 hour for your protection.
        </p>
        <p style="font-size: 12px; color: #70757a; margin-top: 30px;">
          If the button above doesn't work, copy and paste this URL into your browser:
          <br />
          <span style="color: #1a73e8; word-break: break-all;">${resetUrl}</span>
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0 20px 0;" />
        <p style="font-size: 12px; color: #9aa0a6; text-align: center;">
          &copy; ${new Date().getFullYear()} D3S Healthcare. All rights reserved.
        </p>
      </div>
    `;

    await sendEmail(email, 'Password Reset Request - D3S Healthcare', `Reset your password here: ${resetUrl}`, emailHtml);
    res.json({ message: 'Reset link sent to email' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user;
    const query = {
      where: {
        resetToken: token,
        resetTokenExpiry: { [db.Sequelize.Op.gt]: Date.now() }
      }
    };

    if (decoded.type === 'admin') {
      user = await Admin.findOne(query);
    } else if (decoded.type === 'hospital') {
      user = await Hospital.findOne(query);
    } else if (decoded.type === 'doctor') {
      user = await Doctor.findOne(query);
    } else {
      // Fallback for old tokens or if type is missing
      user = await Admin.findOne(query) || await Hospital.findOne(query) || await Doctor.findOne(query);
    }

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.update({
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