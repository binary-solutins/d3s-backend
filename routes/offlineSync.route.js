const express = require('express');
const router = express.Router();
const offlineSyncController = require('../controllers/offlineSync.controller');

/**
 * @swagger
 * tags:
 *   name: Offline Sync
 *   description: Offline synchronization endpoints for React Native app
 */

/**
 * @swagger
 * /api/offline/doctors:
 *   post:
 *     summary: Sync doctor data from offline storage
 *     tags: [Offline Sync]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - specialization
 *               - hospitalId
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Dr. John Doe"
 *               specialization:
 *                 type: string
 *                 example: "Cardiology"
 *               designation:
 *                 type: string
 *                 example: "Senior Consultant"
 *               experience:
 *                 type: integer
 *                 example: 10
 *               hospitalId:
 *                 type: integer
 *                 example: 1
 *               mobile:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: Doctor synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 doctorId:
 *                   type: integer
 *                   example: 123
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Missing required fields: name, specialization, and hospitalId are required"
 *       500:
 *         description: Server error
 */
router.post('/doctors', offlineSyncController.syncDoctor);

/**
 * @swagger
 * /api/offline/patients:
 *   post:
 *     summary: Sync patient data from offline storage
 *     tags: [Offline Sync]
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
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               age:
 *                 type: integer
 *                 example: 35
 *               contact:
 *                 type: string
 *                 example: "+1234567890"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 example: "Male"
 *               hospitalId:
 *                 type: integer
 *                 example: 1
 *               weight:
 *                 type: number
 *                 example: 70.5
 *               height:
 *                 type: number
 *                 example: 175.0
 *               address:
 *                 type: string
 *                 example: "123 Main St, City"
 *               adharNumber:
 *                 type: string
 *                 example: "1234-5678-9012"
 *               email:
 *                 type: string
 *                 example: "john.doe@example.com"
 *     responses:
 *       200:
 *         description: Patient synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 patientId:
 *                   type: integer
 *                   example: 456
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/patients', offlineSyncController.syncPatient);

/**
 * @swagger
 * /api/offline/reports:
 *   post:
 *     summary: Sync report data from offline storage
 *     tags: [Offline Sync]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - doctorId
 *               - patientId
 *               - hospitalId
 *               - title
 *               - pdf
 *             properties:
 *               doctorId:
 *                 type: integer
 *                 example: 123
 *               patientId:
 *                 type: integer
 *                 example: 456
 *               hospitalId:
 *                 type: integer
 *                 example: 1
 *               title:
 *                 type: string
 *                 example: "Blood Test Report"
 *               description:
 *                 type: string
 *                 example: "Complete blood count"
 *               reportType:
 *                 type: string
 *                 enum: [Laboratory, Radiology, Surgical, Pathology, Other]
 *                 example: "Laboratory"
 *               notes:
 *                 type: string
 *                 example: "Additional notes"
 *               createdAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:30:00Z"
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload
 *     responses:
 *       200:
 *         description: Report synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reportId:
 *                   type: integer
 *                   example: 789
 *                 fileUrl:
 *                   type: string
 *                   example: "https://storage.azure.com/..."
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/reports', offlineSyncController.uploadPdfMiddleware, offlineSyncController.syncReport);

module.exports = router;

