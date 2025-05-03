const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');


/**
 * @swagger
 * tags:
 *   name: Patient Reports
 *   description: Management of patient medical reports
 */

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Upload a new patient report
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - title
 *               - reportType
 *               - reportFile
 *               - hospitalId
 *             properties:
 *               patientId:
 *                 type: integer
 *                 description: ID of the patient
 *                 example: 1
 *               title:
 *                 type: string
 *                 description: Title of the report
 *                 example: "Blood Test Results"
 *               description:
 *                 type: string
 *                 description: Description of the report
 *                 example: "Complete blood count and metabolic panel"
 *               reportType:
 *                 type: string
 *                 enum: [Laboratory, Radiology, Surgical, Pathology, Other]
 *                 example: "Laboratory"
 *               reportFile:
 *                 type: string
 *                 format: binary
 *                 description: The report file to upload
 *               hospitalId:
 *                 type: integer
 *                 description: ID of the hospital uploading the report
 *                 example: 123
 *     responses:
 *       201:
 *         description: Report uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 report:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     reportType:
 *                       type: string
 *                     patientId:
 *                       type: integer
 *                     fileName:
 *                       type: string
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input or no file uploaded
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */
router.post('/', reportController.uploadReportFileMiddleware, reportController.createReport);

/**
 * @swagger
 * /api/reports/patient/{patientId}:
 *   get:
 *     summary: Get all reports for a specific patient
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the patient
 *     requestBody:
 *       required: true,
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hospitalId:
 *                 type: integer
 *                 description: ID of the hospital
 *                 example: 123
 *               patientId:
 *                 type: integer
 *                 description: ID of the patient
 *                 example: 1
 *     responses:
 *       200:
 *         description: List of patient reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 patient:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                 reports:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       reportType:
 *                         type: string
 *                       fileName:
 *                         type: string
 *                       fileType:
 *                         type: string
 *                       fileSize:
 *                         type: integer
 *                       fileUrl:
 *                         type: string
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */
router.get('/patient/:patientId', reportController.getPatientReports);

/**
 * @swagger
 * /api/reports/{reportId}:
 *   get:
 *     summary: Get a specific report by ID
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the report
 *     responses:
 *       200:
 *         description: Report details with patient information
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.get('/:reportId', reportController.getReportById);

/**
 * @swagger
 * /api/reports/{reportId}/download:
 *   get:
 *     summary: Download a report file
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the report to download
 *     responses:
 *       200:
 *         description: Report file download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.get('/:reportId/download', reportController.downloadReport);

/**
 * @swagger
 * /api/reports/{reportId}:
 *   put:
 *     summary: Update report details (not the file)
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the report to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Updated Blood Test Results"
 *               description:
 *                 type: string
 *                 example: "Updated description of test results"
 *               reportType:
 *                 type: string
 *                 enum: [Laboratory, Radiology, Surgical, Pathology, Other]
 *                 example: "Laboratory"
 *     responses:
 *       200:
 *         description: Report details updated successfully
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.put('/:reportId', reportController.updateReport);

/**
 * @swagger
 * /api/reports/{reportId}:
 *   delete:
 *     summary: Soft delete a report
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the report to delete
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.delete('/:reportId', reportController.deleteReport);

/**
 * @swagger
 * /api/reports/{reportId}/permanent:
 *   delete:
 *     summary: Permanently delete a report (including file)
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the report to permanently delete
 *     responses:
 *       200:
 *         description: Report permanently deleted
 *       404:
 *         description: Report not found
 *       500:
 *         description: Server error
 */
router.delete('/:reportId/permanent', reportController.permanentDeleteReport);

/**
 * @swagger
 * /api/reports/search:
 *   get:
 *     summary: Search reports with various filters
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: integer
 *         description: ID of the patient
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
 *           enum: [Laboratory, Radiology, Surgical, Pathology, Other]
 *         description: Type of report
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering (YYYY-MM-DD)
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search term for report title or description
 *     responses:
 *       200:
 *         description: List of reports matching search criteria
 *       500:
 *         description: Server error
 */
router.get('/search', reportController.searchReports);

module.exports = router;