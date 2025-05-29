const { Product, Order } = require('../models');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Counter for sequential order IDs
let orderCounter = 1;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // limit to 5MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
}).array('images', 5); // Allow up to 5 images for products

// Middleware for handling file upload
exports.handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Helper function to upload image to Appwrite
const uploadToAppwrite = async (file) => {
  try {
    // Debug log to check file properties
    console.log('File to upload:', {
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      hasBuffer: !!file.buffer,
      bufferLength: file.buffer ? file.buffer.length : 0
    });
    
    // Check if buffer exists and has content
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty or missing');
    }

    const form = new FormData();
    const fileId = uuidv4();

    form.append('fileId', fileId);
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const BUCKET_ID = process.env.APPWRITE_BUCKET_ID;
    const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
    const API_KEY = process.env.APPWRITE_API_KEY;

    const response = await axios.post(
      `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'X-Appwrite-Project': PROJECT_ID,
          'X-Appwrite-Key': API_KEY,
        },
      }
    );

    const uploadedFileId = response.data.$id;
    const fileUrl = `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${uploadedFileId}/view?project=${PROJECT_ID}`;
    return fileUrl;
  } catch (error) {
    console.error('Appwrite upload error:', error);
    throw new Error(`Failed to upload image to Appwrite: ${error.message}`);
  }
};

exports.createProduct = async (req, res) => {
    try {
      let imageUrls = [];
      
      // Check if files were uploaded
      if (req.files && req.files.length > 0) {
        try {
          // Upload all images to Appwrite
          for (const file of req.files) {
            const imageUrl = await uploadToAppwrite(file);
            imageUrls.push(imageUrl);
          }
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          return res.status(400).json({ 
            error: 'Image upload failed. Please try again with different images.',
            details: uploadError.message
          });
        }
      }
  
      // Parse JSON strings if they exist (for multipart/form-data)
      let parsedFeatures = req.body.features;
      let parsedSpecifications = req.body.specifications;
      let parsedHighlights = req.body.highlights;
  
      // Parse features if it's a string
      if (typeof req.body.features === 'string') {
        try {
          parsedFeatures = JSON.parse(req.body.features);
        } catch (e) {
          parsedFeatures = req.body.features;
        }
      }
  
      // Parse specifications if it's a string
      if (typeof req.body.specifications === 'string') {
        try {
          parsedSpecifications = JSON.parse(req.body.specifications);
        } catch (e) {
          parsedSpecifications = req.body.specifications;
        }
      }
  
      // Parse highlights if it's a string
      if (typeof req.body.highlights === 'string') {
        try {
          parsedHighlights = JSON.parse(req.body.highlights);
        } catch (e) {
          parsedHighlights = req.body.highlights;
        }
      }
  
      const productData = {
        ...req.body,
        // Use uploaded image URLs or keep existing ones from request body
        images: imageUrls.length > 0 ? imageUrls : (req.body.images || []),
        features: parsedFeatures,
        specifications: parsedSpecifications,
        // Convert highlights to store only keys (only if it's an array)
        highlights: Array.isArray(parsedHighlights) 
          ? parsedHighlights.map(h => ({
              iconKey: h.iconKey,
              title: h.title,
              desc: h.desc
            }))
          : parsedHighlights
      };
  
      const product = await Product.create(productData);
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

// New function to update product with image upload
exports.updateProduct = async (req, res) => {
    try {
      const productId = req.params.id;
      
      const product = await Product.findByPk(productId);
      
      if (!product) {
        return res.status(404).json({ error: '❌ Product not found' });
      }
      
      let imageUrls = product.images || [];
      
      // Check if files were uploaded
      if (req.files && req.files.length > 0) {
        try {
          // Upload new images to Appwrite
          const newImageUrls = [];
          for (const file of req.files) {
            const imageUrl = await uploadToAppwrite(file);
            newImageUrls.push(imageUrl);
          }
          
          // Replace existing images with new ones
          imageUrls = newImageUrls;
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          return res.status(400).json({ 
            error: 'Image upload failed. Please try again with different images.',
            details: uploadError.message
          });
        }
      }
  
      // Parse JSON strings if they exist (for multipart/form-data)
      let parsedFeatures = req.body.features || product.features;
      let parsedSpecifications = req.body.specifications || product.specifications;
      let parsedHighlights = req.body.highlights || product.highlights;
  
      // Parse features if it's a string
      if (typeof req.body.features === 'string') {
        try {
          parsedFeatures = JSON.parse(req.body.features);
        } catch (e) {
          parsedFeatures = req.body.features;
        }
      }
  
      // Parse specifications if it's a string
      if (typeof req.body.specifications === 'string') {
        try {
          parsedSpecifications = JSON.parse(req.body.specifications);
        } catch (e) {
          parsedSpecifications = req.body.specifications;
        }
      }
  
      // Parse highlights if it's a string
      if (typeof req.body.highlights === 'string') {
        try {
          parsedHighlights = JSON.parse(req.body.highlights);
        } catch (e) {
          parsedHighlights = req.body.highlights;
        }
      }
      
      const updateData = {
        name: req.body.name || product.name,
        price: req.body.price || product.price,
        category: req.body.category || product.category,
        stock: req.body.stock || product.stock,
        rating: req.body.rating || product.rating,
        reviewCount: req.body.reviewCount || product.reviewCount,
        description: req.body.description || product.description,
        images: imageUrls,
        features: parsedFeatures,
        specifications: parsedSpecifications,
        // Convert highlights to store only keys (only if it's an array)
        highlights: Array.isArray(parsedHighlights) 
          ? parsedHighlights.map(h => ({
              iconKey: h.iconKey,
              title: h.title,
              desc: h.desc
            }))
          : parsedHighlights
      };
      
      await product.update(updateData);
      
      res.status(200).json({
        message: '✅ Product updated successfully',
        product
      });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ error: error.message });
    }
  };

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  const id = req.body.product_id;
  
  if (!id) {
    return res.status(400).json({ error: 'Product ID is required' });
  }

  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      billingAddress,
      items,
      subtotal,
      tax,
      total,
      paymentMethod,
      transactionId = null,
      notes = null
    } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: '❌ Items are required' });
    }

    // Check stock for all items
    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        return res.status(404).json({ error: `❌ Product not found: ${item.productId}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `❌ Insufficient stock for product: ${product.name}` });
      }
    }

    // Generate sequential order ID
    const paddedCounter = orderCounter.toString().padStart(6, '0');
    const orderId = `ORD-${paddedCounter}`;
    orderCounter++;

    // Create order
    const order = await Order.create({
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      billingAddress,
      items,
      subtotal,
      tax,
      totalAmount: total,
      paymentMethod,
      transactionId,
      notes
    });

    // Update stock for all items
    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      await product.update({ stock: product.stock - item.quantity });
    }

    res.status(201).json({
      message: '✅ Order placed successfully',
      orderId: order.orderId,
      totalAmount: order.total,
      status: order.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      where: { orderId },
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'price', 'category', 'description', 'images']
      }]
    });

    if (!order) return res.status(404).json({ error: '❌ Order not found' });

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrdersByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const orders = await Order.findAll({
      where: { customerEmail: email },
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'price', 'category', 'images']
      }],
      order: [['createdAt', 'DESC']]
    });

    if (!orders.length) {
      return res.status(404).json({ message: '❌ No orders found for this email' });
    }

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Initialize order counter on startup
exports.initOrderCounter = async () => {
  try {
    const lastOrder = await Order.findOne({
      order: [['createdAt', 'DESC']]
    });
    
    if (lastOrder) {
      const lastId = lastOrder.orderId;
      orderCounter = parseInt(lastId.split('-')[1]) + 1;
      console.log(`🚀 Order counter initialized: ${orderCounter}`);
    }
  } catch (error) {
    console.error('❌ Error initializing order counter:', error);
  }
};