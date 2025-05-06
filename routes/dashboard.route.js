// routes/dashboard.route.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Admin Dashboard
 *   description: System-wide analytics for administrators
 */

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get system-wide analytics
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalHospitals: { type: integer }
 *                     totalPatients: { type: integer }
 *                     totalReports: { type: integer }
 *                     totalDoctors: { type: integer }
 *                     activeSubscriptions: { type: integer }
 *                     verifiedHospitals: { type: integer }
 *                     avgPatientAge: { type: integer }
 *                     maxPatientAge: { type: integer }
 *                     minPatientAge: { type: integer }
 *                 distributions:
 *                   type: object
 *                   properties:
 *                     reportsByType: 
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           reportType: { type: string }
 *                           count: { type: integer }
 *                     genderDistribution: 
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           gender: { type: string }
 *                           count: { type: integer }
 *                     hospitalStatus:
 *                       type: object
 *                       properties:
 *                         verified: { type: integer }
 *                         unverified: { type: integer }
 *                     subscriptions:
 *                       type: object
 *                       properties:
 *                         active: { type: integer }
 *                         expired: { type: integer }
 *                 trends:
 *                   type: object
 *                   properties:
 *                     hospitalGrowth:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month: { type: string }
 *                           count: { type: integer }
 *                     reportTrends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month: { type: string }
 *                           count: { type: integer }
 */
router.get('/admin/dashboard', authMiddleware, dashboardController.getAdminDashboard);

module.exports = router;