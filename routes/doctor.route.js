const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const authMiddleware = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Doctors
 *   description: Doctor management
 */

/**
 * @swagger
 * /api/doctors/login:
 *   post:
 *     summary: Doctor login (Public endpoint)
 *     description: Doctors can login using their email and password. The account must be active and the hospital must be verified.
 *     tags: [Doctors]
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
 *                 format: email
 *                 example: "doctor@hospital.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login successful - Returns JWT token and doctor info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 message:
 *                   type: string
 *                   example: "✅ Login successful"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     specialization:
 *                       type: string
 *                     designation:
 *                       type: string
 *                     hospitalId:
 *                       type: integer
 *                     hospital:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         isVerified:
 *                           type: boolean
 *                     role:
 *                       type: string
 *                       example: "doctor"
 *       400:
 *         description: Missing required fields or invalid email format
 *       401:
 *         description: Invalid credentials, account deactivated, or hospital not verified
 */
router.post('/login', doctorController.login);

/**
 * @swagger
 * /api/doctors:
 *   post:
 *     summary: Create a new doctor account (Hospital/Admin only)
 *     description: |
 *       Only hospitals and admins can create doctor accounts.
 *       - Hospitals can only create doctors for their own hospital (hospitalId is automatically set from token)
 *       - Admins can create doctors for any hospital (hospitalId must be provided in request body)
 *     tags: [Doctors]
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
 *               - specialization
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Dr. John Smith"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Optional. If not provided, email will be set to null and can be added later.
 *                 example: "doctor@hospital.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Optional. If not provided, password will be set to null and can be added later.
 *                 example: "password123"
 *               specialization:
 *                 type: string
 *                 example: "Cardiology"
 *               designation:
 *                 type: string
 *                 example: "Senior Consultant"
 *               hospitalId:
 *                 type: integer
 *                 description: Required only for admin users. For hospitals, this is automatically set from their token.
 *                 example: 1
 *     responses:
 *       201:
 *         description: Doctor account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "✅ Doctor account created successfully"
 *                 doctor:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     specialization:
 *                       type: string
 *                     designation:
 *                       type: string
 *                     hospitalId:
 *                       type: integer
 *                     isActive:
 *                       type: boolean
 *                     hospital:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *       400:
 *         description: Missing required fields (name, specialization), invalid email format, weak password, or email already exists
 *       403:
 *         description: Only hospitals and admins can create doctor accounts
 *       404:
 *         description: Hospital not found
 *       500:
 *         description: Server error
 */
router.post('/', authMiddleware, doctorController.createDoctor);

/**
 * @swagger
 * /api/doctors/hospital/{hospitalId}:
 *   get:
 *     summary: Get all doctors by hospital
 *     tags: [Doctors]
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
 *         description: List of doctors
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/hospital/:hospitalId', authMiddleware, doctorController.getDoctorsByHospital);

/**
 * @swagger
 * /api/doctors/assigned-reports:
 *   get:
 *     summary: Get assigned reports for the authenticated doctor
 *     description: |
 *       Returns all reports assigned to the doctor identified by the JWT token.
 *       Only doctors can access this endpoint. The doctor ID is automatically extracted from the token.
 *       Supports pagination and filtering by report type, checked status, date range, and text search.
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of reports per page
 *       - in: query
 *         name: reportType
 *         schema:
 *           type: string
 *           enum: [Laboratory, Radiology, Surgical, Pathology, Other]
 *         description: Filter by report type
 *       - in: query
 *         name: isChecked
 *         schema:
 *           type: boolean
 *         description: Filter by checked status (true for checked, false for unchecked)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter reports assigned from this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter reports assigned until this date (YYYY-MM-DD)
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search in report title, description, or file name
 *     responses:
 *       200:
 *         description: Assigned reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "✅ Assigned reports retrieved successfully"
 *                 count:
 *                   type: integer
 *                   description: Total number of assigned reports
 *                   example: 25
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                   example: 1
 *                 pageSize:
 *                   type: integer
 *                   description: Number of reports per page
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                   example: 3
 *                 reports:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       title:
 *                         type: string
 *                         example: "Blood Test Report"
 *                       description:
 *                         type: string
 *                         example: "Complete blood count analysis"
 *                       reportType:
 *                         type: string
 *                         enum: [Laboratory, Radiology, Surgical, Pathology, Other]
 *                         example: "Laboratory"
 *                       fileUrl:
 *                         type: string
 *                         example: "https://storage.azure.com/reports/1/lab/2024-01-15/abc123.pdf"
 *                       fileName:
 *                         type: string
 *                         example: "blood_test_report.pdf"
 *                       fileType:
 *                         type: string
 *                         example: "application/pdf"
 *                       fileSize:
 *                         type: integer
 *                         example: 1024000
 *                       assignedDoctorId:
 *                         type: integer
 *                         example: 5
 *                       patientId:
 *                         type: integer
 *                         example: 10
 *                       hospitalId:
 *                         type: integer
 *                         example: 2
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 *                       assignedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T11:00:00Z"
 *                       isChecked:
 *                         type: boolean
 *                         example: false
 *                       patient:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                           gender:
 *                             type: string
 *                           age:
 *                             type: integer
 *                           contact:
 *                             type: string
 *                             description: Patient contact number
 *                           email:
 *                             type: string
 *                           address:
 *                             type: string
 *                       hospital:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           address:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           city:
 *                             type: string
 *                           state:
 *                             type: string
 *                           country:
 *                             type: string
 *                       doctor:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           specialization:
 *                             type: string
 *                           designation:
 *                             type: string
 *                           email:
 *                             type: string
 *       403:
 *         description: Forbidden - Only doctors can access their assigned reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Only doctors can access their assigned reports"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please authenticate"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/assigned-reports', authMiddleware, doctorController.getAssignedReports);

/**
 * @swagger
 * /api/doctors/proxy-pdf:
 *   post:
 *     summary: Proxy PDF from Azure Blob Storage (to avoid CORS errors)
 *     description: |
 *       Fetches a PDF file from Azure Blob Storage URL and serves it through the backend to avoid CORS errors.
 *       Only doctors can access this endpoint. The PDF is streamed directly to the client with proper headers.
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: The Azure Blob Storage URL of the PDF file
 *                 example: "https://yourstorageaccount.blob.core.windows.net/reports/patient123/lab/2024-01-15/abc123.pdf"
 *     responses:
 *       200:
 *         description: PDF file streamed successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             description: application/pdf
 *             schema:
 *               type: string
 *           Access-Control-Allow-Origin:
 *             description: CORS header
 *             schema:
 *               type: string
 *           Cache-Control:
 *             description: Cache control header
 *             schema:
 *               type: string
 *       400:
 *         description: Bad request - Missing or invalid URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ PDF URL is required"
 *       403:
 *         description: Forbidden - Only doctors can access this endpoint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Only doctors can access this endpoint"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Please authenticate"
 *       500:
 *         description: Server error - Failed to fetch PDF
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch PDF"
 *                 message:
 *                   type: string
 *                   example: "Error details"
 *       504:
 *         description: Gateway timeout - Network error or timeout
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Timeout or network error while fetching PDF"
 */
router.post('/proxy-pdf', authMiddleware, doctorController.proxyPdf);

/**
 * @swagger
 * /api/doctors/{id}:
 *   get:
 *     summary: Get a doctor by ID
 *     tags: [Doctors]
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
 *         description: Doctor details
 *       404:
 *         description: Doctor not found
 */
router.get('/:id', authMiddleware, doctorController.getDoctorById);

/**
 * @swagger
 * /api/doctors/{id}:
 *   put:
 *     summary: Update a doctor
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Optional. Update doctor's email address.
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 description: Optional. Update doctor's password.
 *               specialization:
 *                 type: string
 *               designation:
 *                 type: string
 *     responses:
 *       200:
 *         description: Doctor updated
 *       404:
 *         description: Doctor not found
 */
router.put('/:id', authMiddleware, doctorController.updateDoctor);

/**
 * @swagger
 * /api/doctors/{id}:
 *   delete:
 *     summary: Delete a doctor
 *     tags: [Doctors]
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
 *         description: Doctor deleted
 *       404:
 *         description: Doctor not found
 */
router.delete('/:id', authMiddleware, doctorController.deleteDoctor);

/**
 * @swagger
 * /api/doctors/search:
 *   get:
 *     summary: Search doctors
 *     tags: [Doctors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of matching doctors
 */
router.get('/search', authMiddleware, doctorController.searchDoctors);

module.exports = router;
