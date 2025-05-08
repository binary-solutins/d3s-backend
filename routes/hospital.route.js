const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospital.controller');

/**
 * @swagger
 * tags:
 *   name: Hospitals
 *   description: Hospital management
 */

/**
 * @swagger
 * /api/hospitals/signup:
 *   post:
 *     summary: Register a new hospital
 *     tags: [Hospitals]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: "City Hospital"
 *               email:
 *                 type: string
 *                 example: "admin@cityhospital.com"
 *               password:
 *                 type: string
 *                 example: "securePassword123"
 *               phone:
 *                 type: string
 *                 example: "6352972446"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Hospital profile image
 *     responses:
 *       201:
 *         description: OTP sent to email
 *       500:
 *         description: Server error
 */
router.post('/signup', hospitalController.handleFileUpload, hospitalController.signup);

/**
 * @swagger
 * /api/hospitals/verify-otp:
 *   post:
 *     summary: Verify OTP
 *     tags: [Hospitals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 example: "admin@cityhospital.com"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid OTP
 *       404:
 *         description: Hospital not found
 *       500:
 *         description: Server error
 */
router.post('/verify-otp', hospitalController.verifyOtp);

/**
 * @swagger
 * /api/hospitals/login:
 *   post:
 *     summary: Hospital login
 *     tags: [Hospitals]
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
 *                 example: "admin@cityhospital.com"
 *               password:
 *                 type: string
 *                 example: "securePassword123"
 *     responses:
 *       200:
 *         description: Returns JWT token and hospital info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 hospital:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *       401:
 *         description: Invalid credentials or email not verified
 *       500:
 *         description: Server error
 */
router.post('/login', hospitalController.login);

/**
 * @swagger
 * /api/hospitals/{id}:
 *   put:
 *     summary: Update hospital details
 *     tags: [Hospitals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Hospital Name"
 *               email:
 *                 type: string
 *                 example: "updated@cityhospital.com"
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               country:
 *                 type: string
 *                 example: "India"
 *               state:
 *                 type: string
 *                 example: "Gujarat"
 *               city:
 *                 type: string
 *                 example: "Ahmedabad"
 *               address:
 *                 type: string
 *                 example: "123 Main Street"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Updated hospital profile image
 *     responses:
 *       200:
 *         description: Hospital details updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 hospital:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     country:
 *                       type: string
 *                     state:
 *                       type: string
 *                     city:
 *                       type: string
 *                     address:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *       404:
 *         description: Hospital not found
 *       500:
 *         description: Server error
 */
router.put('/:id', hospitalController.handleFileUpload, hospitalController.updateHospital);

module.exports = router;