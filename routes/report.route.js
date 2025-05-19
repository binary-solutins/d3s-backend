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
 *             properties:
 *               patientId:
 *                 type: integer
 *                 description: ID of the patient
 *                 example: 1
 *               doctorId:
 *                 type: integer
 *                 description: ID of the doctor associated with the report
 *                 example: 5
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
 *                 description: Type of medical report
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
 *                   example: "✅ Report uploaded successfully"
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
 *                     doctorId:
 *                       type: integer
 *                     fileName:
 *                       type: string
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input or no file uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ No report file uploaded"
 *       404:
 *         description: Patient or doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Patient not found or not associated with this hospital"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/', reportController.uploadReportFileMiddleware, reportController.createReport);

/**
 * @swagger
 * /api/reports/breast-cancer:
 *   post:
 *     summary: Create a breast cancer report with 6 images
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
 *               - doctorId
 *               - hospitalId
 *               - leftTopImage
 *               - leftCenterImage
 *               - leftBottomImage
 *               - rightTopImage
 *               - rightCenterImage
 *               - rightBottomImage
 *             properties:
 *               patientId:
 *                 type: integer
 *                 description: ID of the patient
 *                 example: 1
 *               doctorId:
 *                 type: integer
 *                 description: ID of the doctor
 *                 example: 5
 *               hospitalId:
 *                 type: integer
 *                 description: ID of the hospital
 *                 example: 123
 *               title:
 *                 type: string
 *                 description: Title of the report
 *                 example: "Breast Cancer Screening Report"
 *               description:
 *                 type: string
 *                 description: Description of the report
 *                 example: "Breast cancer screening with 6 images"
 *               leftTopImage:
 *                 type: string
 *                 format: binary
 *                 description: Left breast top view image
 *               leftCenterImage:
 *                 type: string
 *                 format: binary
 *                 description: Left breast center view image
 *               leftBottomImage:
 *                 type: string
 *                 format: binary
 *                 description: Left breast bottom view image
 *               rightTopImage:
 *                 type: string
 *                 format: binary
 *                 description: Right breast top view image
 *               rightCenterImage:
 *                 type: string
 *                 format: binary
 *                 description: Right breast center view image
 *               rightBottomImage:
 *                 type: string
 *                 format: binary
 *                 description: Right breast bottom view image
 *     responses:
 *       201:
 *         description: Breast cancer report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "✅ Breast cancer report generated and uploaded successfully"
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
 *                     doctorId:
 *                       type: integer
 *                     fileName:
 *                       type: string
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing required fields or images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Missing required breast images: leftTopImage, rightTopImage"
 *       404:
 *         description: Patient or doctor not found
 *       500:
 *         description: Server error
 */
router.post('/breast-cancer', reportController.uploadBreastCancerImagesMiddleware, reportController.createBreastCancerReport);

/**
 * @swagger
 * /api/reports/patient/{patientId}:
 *   post:
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hospitalId:
 *                 type: integer
 *                 description: ID of the hospital
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
 *                       uploadedBy:
 *                         type: integer
 *                       doctorId:
 *                         type: integer
 *                       metadata:
 *                         type: object
 *       404:
 *         description: Patient not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Patient not found or not associated with this hospital"
 *       500:
 *         description: Server error
 */

router.post('/patient/:patientId', reportController.getPatientReports);


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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 report:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     reportType:
 *                       type: string
 *                     fileUrl:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     fileType:
 *                       type: string
 *                     fileSize:
 *                       type: integer
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *                     patient:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         gender:
 *                           type: string
 *                         age:
 *                           type: integer
 *                     doctor:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         specialization:
 *                           type: string
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Report not found"
 *       500:
 *         description: Server error
 */
router.get('/:reportId', reportController.getReportById);

/**
 * @swagger
 * /api/reports/hospital/{hospitalId}:
 *   get:
 *     summary: Get all reports for a specific hospital
 *     tags: [Patient Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hospitalId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the hospital
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of hospital reports with pagination info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *                 reports:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       reportType:
 *                         type: string
 *                       patientId:
 *                         type: integer
 *                       doctorId:
 *                         type: integer
 *                       fileName:
 *                         type: string
 *                       fileUrl:
 *                         type: string
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: No reports found for this hospital
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "❌ No reports found for this hospital"
 *       500:
 *         description: Server error
 */
router.get('/hospital/:hospitalId', reportController.getReportsByHospitalId);



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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Report not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Error downloading file"
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
 *                 example: "Laboratory"
 *               doctorId:
 *                 type: integer
 *                 example: 5
 *               hospitalId:
 *                 type: integer
 *                 example: 123
 *     responses:
 *       200:
 *         description: Report details updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "✅ Report details updated successfully"
 *                 report:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     reportType:
 *                       type: string
 *                     doctorId:
 *                       type: integer
 *       404:
 *         description: Report or doctor not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Report not found"
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "✅ Report deleted successfully"
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Report not found"
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hospitalId:
 *                 type: integer
 *                 description: ID of the hospital
 *                 example: 123
 *     responses:
 *       200:
 *         description: Report permanently deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "✅ Report permanently deleted"
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Report not found"
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
 *         name: doctorId
 *         schema:
 *           type: integer
 *         description: ID of the doctor
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
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
 *         description: Search term for report title, description or filename
 *     responses:
 *       200:
 *         description: List of reports matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
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
 *                       fileUrl:
 *                         type: string
 *                       fileName:
 *                         type: string
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *                       patient:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                       doctor:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                           specialization:
 *                             type: string
 *       500:
 *         description: Server error
 */
router.get('/search', reportController.searchReports);

module.exports = router;