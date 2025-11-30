// routes/admin.route.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management
 */

/**
 * @swagger
 * /api/admin/signup:
 *   post:
 *     summary: Register a new admin
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin created
 */
router.post('/signup', adminController.signup);

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Admin or Hospital login (unified endpoint)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email address (admin or hospital)
 *               password:
 *                 type: string
 *                 description: Password
 *     responses:
 *       200:
 *         description: Returns JWT token and user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [admin, hospital]
 *                 role:
 *                   type: string
 *       401:
 *         description: Invalid credentials or account not verified
 */
router.post('/login', adminController.login);

/**
 * @swagger
 * /api/admin/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset token sent to email
 */
router.post('/forgot-password', adminController.forgotPassword);

/**
 * @swagger
 * /api/admin/reset-password:
 *   post:
 *     summary: Reset password
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post('/reset-password', adminController.resetPassword);



/**
 * @swagger
 * /api/admin/hospitals:
 *   get:
 *     summary: Get all hospitals
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of hospitals
 */
router.get('/hospitals', authMiddleware, adminController.getAllHospitals);

/**
 * @swagger
 * /api/admin/hospitals/{hospitalId}:
 *   put:
 *     summary: Update hospital status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isVerified:
 *                 type: boolean
 *               plan_time:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Hospital updated
 */
router.put('/hospitals/:hospitalId', authMiddleware, adminController.updateHospitalStatus);

module.exports = router;