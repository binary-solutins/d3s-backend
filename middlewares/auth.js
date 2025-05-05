// middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../models');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      throw new Error('Access denied');
    }

    const admin = await db.Admin.findByPk(decoded.id);
    if (!admin) throw new Error('Admin not found');

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};