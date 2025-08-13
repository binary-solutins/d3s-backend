const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management
 *   name: Products
 *   description: Product management
 */

/**
 * @swagger
 * /api/orders/products:
 *   post:
 *     summary: Create a new product with image upload
 *     tags: [Products]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Professional ECG Monitor Pro X1"
 *               price:
 *                 type: number
 *                 example: 2999
 *               category:
 *                 type: string
 *                 example: "ecg"
 *               stock:
 *                 type: integer
 *                 example: 15
 *               rating:
 *                 type: number
 *                 example: 4.8
 *               reviewCount:
 *                 type: integer
 *                 example: 124
 *               description:
 *                 type: string
 *                 example: "Advanced 12-lead ECG monitoring system"
 *               features:
 *                 type: string
 *                 example: '["AI-powered ECG analysis", "12-lead monitoring"]'
 *               specifications:
 *                 type: string
 *                 example: '{"Model": "ECG-PRO-X1", "Channels": "12-lead"}'
 *               highlights:
 *                 type: string
 *                 example: '[{"iconKey": "Zap", "title": "Fast Results", "desc": "Get ECG analysis in under 10 seconds"}]'
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Upload multiple product images (max 5)
 *             required:
 *               - name
 *               - price
 *               - category
 *               - description
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Image upload failed or validation error
 *       500:
 *         description: Server error
 */
router.post('/products', orderController.handleFileUpload, orderController.createProduct);

/**
 * @swagger
 * /api/orders/products/{id}:
 *   put:
 *     summary: Update a product with image upload
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               stock:
 *                 type: integer
 *               rating:
 *                 type: number
 *               reviewCount:
 *                 type: integer
 *               description:
 *                 type: string
 *               features:
 *                 type: string
 *               specifications:
 *                 type: string
 *               highlights:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Upload new product images (will replace existing ones)
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Image upload failed or validation error
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.put('/products/:id', orderController.handleFileUpload, orderController.updateProduct);


/**
 * @swagger
 * /api/orders/products/{id}:
 *   delete:
 *     summary: Delete a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID to delete
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "✅ Product deleted successfully"
 *                 deletedProduct:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     name:
 *                       type: string
 *                       example: "Professional ECG Monitor Pro X1"
 *                     category:
 *                       type: string
 *                       example: "ecg"
 *       400:
 *         description: Bad request - Product ID is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Product ID is required"
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Product not found"
 *       409:
 *         description: Conflict - Product has active orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Cannot delete product with active orders"
 *                 details:
 *                   type: string
 *                   example: "Product has 2 active order(s). Please complete or cancel these orders first."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "❌ Failed to delete product"
 *                 details:
 *                   type: string
 *                   example: "Database connection error"
 */
router.delete('/products/:id', orderController.deleteProduct);

/**
 * @swagger
 * /api/orders/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of products
 *       500:
 *         description: Server error
 */
router.get('/products', orderController.getAllProducts);

/**
 * @swagger
 * /api/orders/getProductById:
 *   post:
 *     summary: Get product by ID
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: string
 *                 description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.post('/getProductById', orderController.getProductById);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Place a new order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderRequest'
 *     responses:
 *       201:
 *         description: Order placed
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.post('/', orderController.placeOrder);

/**
 * @swagger
 * /api/orders/{orderId}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get('/:orderId', orderController.getOrderById);

/**
 * @swagger
 * /api/orders/customer/{email}:
 *   get:
 *     summary: Get orders by customer email
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer orders
 *       404:
 *         description: No orders found
 *       500:
 *         description: Server error
 */
router.get('/customer/:email', orderController.getOrdersByEmail);

// Swagger components
/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - category
 *         - description
 *       properties:
 *         name:
 *           type: string
 *           example: "Professional ECG Monitor Pro X1"
 *         price:
 *           type: number
 *           format: float
 *           example: 2999
 *         category:
 *           type: string
 *           example: "ecg"
 *         stock:
 *           type: integer
 *           example: 15
 *         rating:
 *           type: number
 *           format: float
 *           example: 4.8
 *         reviewCount:
 *           type: integer
 *           example: 124
 *         description:
 *           type: string
 *           example: "Advanced 12-lead ECG monitoring system with AI-powered analysis..."
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://yourstorageaccount.blob.core.windows.net/product-images/products/2024-01-15/..."]
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           example: ["AI-powered ECG analysis", "12-lead simultaneous monitoring"]
 *         specifications:
 *           type: object
 *           properties:
 *             Model:
 *               type: string
 *               example: "ECG-PRO-X1"
 *             Channels:
 *               type: string
 *               example: "12-lead"
 *         highlights:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               iconKey:
 *                 type: string
 *                 example: "Zap"
 *               title:
 *                 type: string
 *                 example: "Fast Results"
 *               desc:
 *                 type: string
 *                 example: "Get ECG analysis in under 10 seconds"
 * 
 *     OrderRequest:
 *       type: object
 *       required:
 *         - productId
 *         - customerName
 *         - customerEmail
 *         - customerPhone
 *         - shippingAddress
 *         - billingAddress
 *         - paymentMethod
 *       properties:
 *         productId:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8"
 *         customerName:
 *           type: string
 *           example: "John Doe"
 *         customerEmail:
 *           type: string
 *           format: email
 *           example: "john@example.com"
 *         customerPhone:
 *           type: string
 *           example: "+1234567890"
 *         shippingAddress:
 *           type: string
 *           example: "123 Medical St, Health City"
 *         billingAddress:
 *           type: string
 *           example: "123 Medical St, Health City"
 *         quantity:
 *           type: integer
 *           example: 1
 *         paymentMethod:
 *           type: string
 *           enum: ["Credit Card", "Debit Card", "Net Banking", "UPI", "COD"]
 *           example: "Credit Card"
 *         transactionId:
 *           type: string
 *           example: "txn_123456789"
 *         notes:
 *           type: string
 *           example: "Urgent delivery required"
 */

module.exports = router;