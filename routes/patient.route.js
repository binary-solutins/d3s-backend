const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const authMiddleware = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Patient management
 */

/**
 * @swagger
 * /api/patients:
 *   post:
 *     summary: Create a new patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - age
 *               - contact
 *               - gender
 *               - hospitalId
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "Alice"
 *               lastName:
 *                 type: string
 *                 example: "Johnson"
 *               age:
 *                 type: integer
 *                 example: 35
 *               weight:
 *                 type: number
 *                 format: float
 *                 example: 65.5
 *               height:
 *                 type: number
 *                 format: float
 *                 example: 165.3
 *               contact:
 *                 type: string
 *                 example: "9876543210"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 example: "Female"
 *               address:
 *                 type: string
 *                 example: "123 Main St, City"
 *               adharNumber:
 *                 type: string
 *                 example: "1234 5678 9012"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "alice@example.com"
 *               hospitalId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Patient created successfully
 *       404:
 *         description: Hospital not found
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, patientController.createPatient);

/**
 * @swagger
 * /api/patients/hospital/{hospitalId}:
 *   get:
 *     summary: Get patients by hospital
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: List of patients
 *       500:
 *         description: Server error
 */
router.get('/hospital/:hospitalId', authMiddleware, patientController.getPatientsByHospital);

/**
 * @swagger
 * /api/patients/{id}:
 *   get:
 *     summary: Get a patient by ID
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Patient details
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */
router.get('/:id', authMiddleware, patientController.getPatientById);

/**
 * @swagger
 * /api/patients/{id}:
 *   put:
 *     summary: Update a patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               age:
 *                 type: integer
 *               weight:
 *                 type: number
 *                 format: float
 *               height:
 *                 type: number
 *                 format: float
 *               contact:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *               address:
 *                 type: string
 *               adharNumber:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Patient updated
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authMiddleware, patientController.updatePatient);

/**
 * @swagger
 * /api/patients/{id}:
 *   delete:
 *     summary: Delete a patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Patient deleted
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authMiddleware, patientController.deletePatient);

/**
 * @swagger
 * /api/patients/search:
 *   get:
 *     summary: Search patients
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search term for patient name, adhar, email or contact
 *       - in: query
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: List of matching patients
 *       500:
 *         description: Server error
 */
router.get('/search', authMiddleware, patientController.searchPatients);

module.exports = router;