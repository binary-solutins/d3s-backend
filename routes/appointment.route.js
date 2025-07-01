const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Appointment management
 */

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - service
 *               - date
 *               - time
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 example: "+1 (555) 123-4567"
 *               service:
 *                 type: string
 *                 enum: ["breast-scan", "ecg", "comprehensive"]
 *                 example: "breast-scan"
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-07-15"
 *               time:
 *                 type: string
 *                 enum: ["morning", "afternoon", "evening"]
 *                 example: "morning"
 *               address:
 *                 type: string
 *                 example: "123 Main Street, City, State, ZIP"
 *               notes:
 *                 type: string
 *                 example: "Any special requirements"
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post('/', appointmentController.createAppointment);

/**
 * @swagger
 * /api/appointments:
 *   get:
 *     summary: Get all appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["pending", "confirmed", "completed", "cancelled"]
 *         description: Filter by appointment status
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *           enum: ["breast-scan", "ecg", "comprehensive"]
 *         description: Filter by service type
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by appointment date
 *     responses:
 *       200:
 *         description: List of appointments
 *       500:
 *         description: Server error
 */
router.get('/', appointmentController.getAllAppointments);

/**
 * @swagger
 * /api/appointments/{id}:
 *   get:
 *     summary: Get an appointment by ID
 *     tags: [Appointments]
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
 *         description: Appointment details
 *       404:
 *         description: Appointment not found
 */
router.get('/:id', appointmentController.getAppointmentById);

/**
 * @swagger
 * /api/appointments/{id}:
 *   put:
 *     summary: Update an appointment
 *     tags: [Appointments]
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               service:
 *                 type: string
 *                 enum: ["breast-scan", "ecg", "comprehensive"]
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *                 enum: ["morning", "afternoon", "evening"]
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: ["pending", "confirmed", "completed", "cancelled"]
 *     responses:
 *       200:
 *         description: Appointment updated
 *       404:
 *         description: Appointment not found
 */
router.put('/:id', appointmentController.updateAppointment);

/**
 * @swagger
 * /api/appointments/{id}/status:
 *   patch:
 *     summary: Update appointment status
 *     tags: [Appointments]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: ["pending", "confirmed", "completed", "cancelled"]
 *                 example: "confirmed"
 *     responses:
 *       200:
 *         description: Appointment status updated
 *       404:
 *         description: Appointment not found
 */
router.patch('/:id/status', appointmentController.updateAppointmentStatus);

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Delete an appointment
 *     tags: [Appointments]
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
 *         description: Appointment deleted
 *       404:
 *         description: Appointment not found
 */
router.delete('/:id', appointmentController.deleteAppointment);

/**
 * @swagger
 * /api/appointments/search:
 *   get:
 *     summary: Search appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search by name, email, or phone
 *     responses:
 *       200:
 *         description: List of matching appointments
 */
router.get('/search', appointmentController.searchAppointments);

/**
 * @swagger
 * /api/appointments/availability:
 *   get:
 *     summary: Check availability for a specific date and time
 *     tags: [Appointments]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: time
 *         required: true
 *         schema:
 *           type: string
 *           enum: ["morning", "afternoon", "evening"]
 *     responses:
 *       200:
 *         description: Availability status
 */
router.get('/availability', appointmentController.checkAvailability);

module.exports = router;