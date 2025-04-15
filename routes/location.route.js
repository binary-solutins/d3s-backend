const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Geographic location management
 */

/**
 * @swagger
 * /api/countries:
 *   get:
 *     summary: Get all countries for dropdown
 *     tags: [Locations]
 *     responses:
 *       200:
 *         description: Success response with countries list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "United States"
 *                       isoCode:
 *                         type: string
 *                         example: "US"
 *       500:
 *         description: Server error
 */
router.get('/countries', locationController.getAllCountries);

/**
 * @swagger
 * /api/countries/{countryId}/states:
 *   get:
 *     summary: Get states by country ID
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: countryId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Success response with states list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 23
 *                       name:
 *                         type: string
 *                         example: "California"
 *                       stateCode:
 *                         type: string
 *                         example: "CA"
 *       500:
 *         description: Server error
 */
router.get('/countries/:countryId/states', locationController.getStatesByCountry);

/**
 * @swagger
 * /api/states/{stateId}/cities:
 *   get:
 *     summary: Get cities by state ID
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: stateId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 23
 *     responses:
 *       200:
 *         description: Success response with cities list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 456
 *                       name:
 *                         type: string
 *                         example: "Los Angeles"
 *       500:
 *         description: Server error
 */
router.get('/states/:stateId/cities', locationController.getCitiesByState);

module.exports = router;