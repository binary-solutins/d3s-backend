const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

/**
 * @swagger
 * tags:
 *   name: analytics
 *   description: Hospital analytics analytics and statistics
 */

/**
 * @swagger
 * /api/analytics/{hospitalId}:
 *   get:
 *     summary: Get comprehensive analytics data for a hospital
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *         example: 1
 *     responses:
 *       200:
 *         description: analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: object
 *                   properties:
 *                     totalPatients:
 *                       type: integer
 *                       example: 150
 *                     totalDoctors:
 *                       type: integer
 *                       example: 25
 *                     totalReports:
 *                       type: integer
 *                       example: 300
 *                     recentPatients:
 *                       type: integer
 *                       example: 12
 *                     recentReports:
 *                       type: integer
 *                       example: 45
 *                 demographics:
 *                   type: object
 *                   properties:
 *                     genderDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           gender:
 *                             type: string
 *                             example: "Male"
 *                           count:
 *                             type: integer
 *                             example: 75
 *                     ageGroupDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           ageGroup:
 *                             type: string
 *                             example: "18-30"
 *                           count:
 *                             type: integer
 *                             example: 45
 *                 doctors:
 *                   type: object
 *                   properties:
 *                     specializationDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           specialization:
 *                             type: string
 *                             example: "Cardiology"
 *                           count:
 *                             type: integer
 *                             example: 5
 *                 reports:
 *                   type: object
 *                   properties:
 *                     typeDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           reportType:
 *                             type: string
 *                             example: "Laboratory"
 *                           count:
 *                             type: integer
 *                             example: 120
 *       404:
 *         description: Hospital not found
 *       500:
 *         description: Server error
 */
router.get('/:hospitalId', analyticsController.getDashboardData);

/**
 * @swagger
 * /api/analytics/{hospitalId}/patient-trends:
 *   get:
 *     summary: Get patient registration trends
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, yearly]
 *           default: monthly
 *         description: Time period for trends
 *     responses:
 *       200:
 *         description: Patient trends data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                   example: "monthly"
 *                 trends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                         example: "2024-01"
 *                       count:
 *                         type: integer
 *                         example: 25
 *       500:
 *         description: Server error
 */
router.get('/:hospitalId/patient-trends', analyticsController.getPatientTrends);

/**
 * @swagger
 * /api/analytics/{hospitalId}/report-trends:
 *   get:
 *     summary: Get report upload trends and analytics
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, yearly]
 *           default: monthly
 *         description: Time period for trends
 *     responses:
 *       200:
 *         description: Report trends data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                   example: "monthly"
 *                 trends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                         example: "2024-01"
 *                       reportType:
 *                         type: string
 *                         example: "Laboratory"
 *                       count:
 *                         type: integer
 *                         example: 15
 *       500:
 *         description: Server error
 */
router.get('/:hospitalId/report-trends', analyticsController.getReportTrends);

/**
 * @swagger
 * /api/analytics/{hospitalId}/doctor-analytics:
 *   get:
 *     summary: Get detailed doctor analytics
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: Doctor analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDoctors:
 *                   type: integer
 *                   example: 25
 *                 recentDoctors:
 *                   type: integer
 *                   example: 3
 *                 specializationBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       specialization:
 *                         type: string
 *                         example: "Cardiology"
 *                       count:
 *                         type: integer
 *                         example: 5
 *       500:
 *         description: Server error
 */
router.get('/:hospitalId/doctor-analytics', analyticsController.getDoctorAnalytics);

/**
 * @swagger
 * /api/analytics/{hospitalId}/quick-stats:
 *   get:
 *     summary: Get quick statistics for analytics widgets
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *     responses:
 *       200:
 *         description: Quick statistics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totals:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: integer
 *                       example: 150
 *                     doctors:
 *                       type: integer
 *                       example: 25
 *                     reports:
 *                       type: integer
 *                       example: 300
 *                 today:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: integer
 *                       example: 5
 *                     reports:
 *                       type: integer
 *                       example: 12
 *                 thisWeek:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: integer
 *                       example: 15
 *                     reports:
 *                       type: integer
 *                       example: 35
 *                 thisMonth:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: integer
 *                       example: 45
 *                     reports:
 *                       type: integer
 *                       example: 120
 *       500:
 *         description: Server error
 */
router.get('/:hospitalId/quick-stats', analyticsController.getQuickStats);

/**
 * @swagger
 * /api/analytics/{hospitalId}/recent-activities:
 *   get:
 *     summary: Get recent activities for the hospital
 *     tags: [analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Hospital ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of activities to return
 *     responses:
 *       200:
 *         description: Recent activities data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [patient_registered, report_uploaded]
 *                         example: "patient_registered"
 *                       message:
 *                         type: string
 *                         example: "New patient registered: John Doe"
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                       entityId:
 *                         type: integer
 *                         example: 123
 *                       patientName:
 *                         type: string
 *                         example: "John Doe"
 *                 total:
 *                   type: integer
 *                   example: 10
 *       500:
 *         description: Server error
 */
router.get('/:hospitalId/recent-activities', analyticsController.getRecentActivities);

module.exports = router;