const { Product, Order } = require("../models");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
// Azure Blob Storage imports
const { BlobServiceClient } = require('@azure/storage-blob');

// Counter for sequential order IDs
let orderCounter = 1;

// Initialize Azure Blob Service Client
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerName = 'product-images';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // limit to 5MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  },
}).array("images", 5);

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

// Helper function to upload image to Azure Blob Storage
const uploadToAzureBlob = async (file) => {
  try {
    // Check if buffer exists and has content
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty or missing');
    }

    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob'
    });

    // Generate unique blob name
    const fileId = uuidv4();
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileExtension = path.extname(file.originalname);
    const blobName = `products/${timestamp}/${fileId}${fileExtension}`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload options
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
        blobCacheControl: 'public, max-age=31536000',
        blobContentDisposition: `inline; filename="${file.originalname}"`
      },
      metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
        originalSize: file.size.toString()
      }
    };

    // Upload file buffer to blob
    await blockBlobClient.upload(
      file.buffer, 
      file.buffer.length,
      uploadOptions
    );

    // Return the file URL
    return blockBlobClient.url;
  } catch (error) {
    console.error('Azure Blob upload error:', error);
    throw new Error(`Failed to upload image to Azure Blob Storage: ${error.message}`);
  }
};


exports.createProduct = async (req, res) => {
  try {
    let imageUrls = [];

    // Check if files were uploaded
    if (req.files && req.files.length > 0) {
      try {
        // Upload all images to Azure Blob Storage
        for (const file of req.files) {
          const imageUrl = await uploadToAzureBlob(file);
          imageUrls.push(imageUrl);
        }
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(400).json({
          error: "Image upload failed. Please try again with different images.",
          details: uploadError.message,
        });
      }
    }

    // Parse JSON strings if they exist (for multipart/form-data)
    let parsedFeatures = req.body.features;
    let parsedSpecifications = req.body.specifications;
    let parsedHighlights = req.body.highlights;

    // Parse features if it's a string
    if (typeof req.body.features === "string") {
      try {
        parsedFeatures = JSON.parse(req.body.features);
      } catch (e) {
        parsedFeatures = req.body.features;
      }
    }

    // Parse specifications if it's a string
    if (typeof req.body.specifications === "string") {
      try {
        parsedSpecifications = JSON.parse(req.body.specifications);
      } catch (e) {
        parsedSpecifications = req.body.specifications;
      }
    }

    // Parse highlights if it's a string
    if (typeof req.body.highlights === "string") {
      try {
        parsedHighlights = JSON.parse(req.body.highlights);
      } catch (e) {
        parsedHighlights = req.body.highlights;
      }
    }

    const productData = {
      ...req.body,
      // Use uploaded image URLs or keep existing ones from request body
      images: imageUrls.length > 0 ? imageUrls : req.body.images || [],
      features: parsedFeatures,
      specifications: parsedSpecifications,
      // Convert highlights to store only keys (only if it's an array)
      highlights: Array.isArray(parsedHighlights)
        ? parsedHighlights.map((h) => ({
            iconKey: h.iconKey,
            title: h.title,
            desc: h.desc,
          }))
        : parsedHighlights,
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
      return res.status(404).json({ error: "❌ Product not found" });
    }

    let imageUrls = product.images || [];

    // Check if files were uploaded
    if (req.files && req.files.length > 0) {
      try {
        // Upload new images to Azure Blob Storage
        const newImageUrls = [];
        for (const file of req.files) {
          const imageUrl = await uploadToAzureBlob(file);
          newImageUrls.push(imageUrl);
        }

        // Replace existing images with new ones
        imageUrls = newImageUrls;
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(400).json({
          error: "Image upload failed. Please try again with different images.",
          details: uploadError.message,
        });
      }
    }

    // Parse JSON strings if they exist (for multipart/form-data)
    let parsedFeatures = req.body.features || product.features;
    let parsedSpecifications =
      req.body.specifications || product.specifications;
    let parsedHighlights = req.body.highlights || product.highlights;

    // Parse features if it's a string
    if (typeof req.body.features === "string") {
      try {
        parsedFeatures = JSON.parse(req.body.features);
      } catch (e) {
        parsedFeatures = req.body.features;
      }
    }

    // Parse specifications if it's a string
    if (typeof req.body.specifications === "string") {
      try {
        parsedSpecifications = JSON.parse(req.body.specifications);
      } catch (e) {
        parsedSpecifications = req.body.specifications;
      }
    }

    // Parse highlights if it's a string
    if (typeof req.body.highlights === "string") {
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
        ? parsedHighlights.map((h) => ({
            iconKey: h.iconKey,
            title: h.title,
            desc: h.desc,
          }))
        : parsedHighlights,
    };

    await product.update(updateData);

    res.status(200).json({
      message: "✅ Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId) {
      return res.status(400).json({ error: "❌ Product ID is required" });
    }

    // Find the product first to check if it exists
    const product = await Product.findByPk(productId);

    if (!product) {
      return res.status(404).json({ error: "❌ Product not found" });
    }

    // Optional: Check if there are any pending orders for this product
    // This prevents deletion of products that are part of active orders
    const pendingOrders = await Order.findAll({
      where: { 
        productId: productId,
        status: ['Pending', 'Confirmed', 'Shipped']
      }
    });

    if (pendingOrders.length > 0) {
      return res.status(409).json({ 
        error: "❌ Cannot delete product with active orders",
        details: `Product has ${pendingOrders.length} active order(s). Please complete or cancel these orders first.`
      });
    }

    // Store product info for response
    const productInfo = {
      id: product.id,
      name: product.name,
      category: product.category
    };

    // Delete the product
    await product.destroy();

    res.status(200).json({
      success: true,
      message: "✅ Product deleted successfully",
      deletedProduct: productInfo
    });

  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      error: "❌ Failed to delete product",
      details: error.message,
    });
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
    return res.status(400).json({ error: "Product ID is required" });
  }

  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
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
      tax = 0,
      total,
      paymentMethod,
      transactionId = null,
      notes = null,
    } = req.body;

    // Validate required fields
    if (
      !customerName ||
      !customerEmail ||
      !customerPhone ||
      !shippingAddress ||
      !billingAddress
    ) {
      return res
        .status(400)
        .json({ error: "❌ Missing required customer information" });
    }

    if (!paymentMethod || !subtotal || !total) {
      return res
        .status(400)
        .json({ error: "❌ Missing required order information" });
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "❌ Items are required and must be an array" });
    }

    // Validate each item structure
    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        return res.status(400).json({
          error: "❌ Each item must have productId, quantity, and price",
        });
      }
      if (item.quantity <= 0) {
        return res.status(400).json({
          error: "❌ Item quantity must be greater than 0",
        });
      }
    }

    // Check if products exist and have sufficient stock
    const productChecks = [];
    for (const item of items) {
      const product = await Product.findByPk(item.productId);
      if (!product) {
        return res.status(404).json({
          error: `❌ Product not found: ${item.productId}`,
        });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: `❌ Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
        });
      }
      productChecks.push({ product, item });
    }

    // Generate unique order ID
    const paddedCounter = orderCounter.toString().padStart(6, "0");
    const orderId = `ORD-${paddedCounter}`;
    orderCounter++;

    // Create order entries and update stock
    const orderPromises = productChecks.map(async ({ product, item }) => {
      // Calculate item total
      const itemTotal = item.quantity * item.price;

      // Update product stock
      await product.update({
        stock: product.stock - item.quantity,
      });

      // Create order entry
      return Order.create({
        orderId,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        billingAddress,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        itemTotal,
        subtotal,
        tax,
        totalAmount: total,
        paymentMethod,
        transactionId,
        notes,
      });
    });

    const createdOrders = await Promise.all(orderPromises);

    res.status(201).json({
      success: true,
      message: "✅ Order placed successfully",
      orderId,
      itemCount: createdOrders.length,
      subtotal,
      tax,
      totalAmount: total,
      status: createdOrders[0].status,
      paymentMethod,
      transactionId,
    });
  } catch (error) {
    console.error("Place order error:", error);
    res.status(500).json({
      error: "❌ Failed to place order",
      details: error.message,
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "❌ Order ID is required" });
    }

    const orders = await Order.findAll({
      where: { orderId },
      include: [
        {
          model: Product,
          as: "product",
          attributes: [
            "id",
            "name",
            "price",
            "category",
            "description",
            "images",
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    if (!orders.length) {
      return res.status(404).json({ error: "❌ Order not found" });
    }

    // Group order data
    const orderData = {
      orderId: orders[0].orderId,
      customerName: orders[0].customerName,
      customerEmail: orders[0].customerEmail,
      customerPhone: orders[0].customerPhone,
      shippingAddress: orders[0].shippingAddress,
      billingAddress: orders[0].billingAddress,
      subtotal: orders[0].subtotal,
      tax: orders[0].tax,
      totalAmount: orders[0].totalAmount,
      status: orders[0].status,
      paymentMethod: orders[0].paymentMethod,
      transactionId: orders[0].transactionId,
      notes: orders[0].notes,
      createdAt: orders[0].createdAt,
      updatedAt: orders[0].updatedAt,
      items: orders.map((order) => ({
        productId: order.productId,
        product: order.product,
        quantity: order.quantity,
        price: order.price,
        itemTotal: order.itemTotal,
      })),
    };

    res.status(200).json(orderData);
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      error: "❌ Failed to retrieve order",
      details: error.message,
    });
  }
};

exports.getOrdersByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "❌ Email is required" });
    }

    const orders = await Order.findAll({
      where: { customerEmail: email },
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "price", "category", "images"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    if (!orders.length) {
      return res.status(404).json({
        message: "❌ No orders found for this email",
        email,
      });
    }

    // Group orders by orderId
    const groupedOrders = {};
    orders.forEach((order) => {
      if (!groupedOrders[order.orderId]) {
        groupedOrders[order.orderId] = {
          orderId: order.orderId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
          subtotal: order.subtotal,
          tax: order.tax,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentMethod: order.paymentMethod,
          transactionId: order.transactionId,
          notes: order.notes,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: [],
        };
      }

      groupedOrders[order.orderId].items.push({
        productId: order.productId,
        product: order.product,
        quantity: order.quantity,
        price: order.price,
        itemTotal: order.itemTotal,
      });
    });

    const result = Object.values(groupedOrders);

    res.status(200).json({
      success: true,
      count: result.length,
      orders: result,
    });
  } catch (error) {
    console.error("Get orders by email error:", error);
    res.status(500).json({
      error: "❌ Failed to retrieve orders",
      details: error.message,
    });
  }
};

// Get all orders (admin function)
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "price", "category", "images"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Group orders by orderId
    const groupedOrders = {};
    orders.forEach((order) => {
      if (!groupedOrders[order.orderId]) {
        groupedOrders[order.orderId] = {
          orderId: order.orderId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
          subtotal: order.subtotal,
          tax: order.tax,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentMethod: order.paymentMethod,
          transactionId: order.transactionId,
          notes: order.notes,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: [],
        };
      }

      groupedOrders[order.orderId].items.push({
        productId: order.productId,
        product: order.product,
        quantity: order.quantity,
        price: order.price,
        itemTotal: order.itemTotal,
      });
    });

    const result = Object.values(groupedOrders);

    res.status(200).json({
      success: true,
      totalRecords: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      orders: result,
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      error: "❌ Failed to retrieve orders",
      details: error.message,
    });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        error: "❌ Order ID and status are required",
      });
    }

    const validStatuses = [
      "Pending",
      "Confirmed",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error:
          "❌ Invalid status. Valid statuses are: " + validStatuses.join(", "),
      });
    }

    const [updatedRowsCount] = await Order.update(
      { status },
      { where: { orderId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ error: "❌ Order not found" });
    }

    res.status(200).json({
      success: true,
      message: `✅ Order status updated to ${status}`,
      orderId,
      newStatus: status,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      error: "❌ Failed to update order status",
      details: error.message,
    });
  }
};

// Initialize order counter on startup
exports.initOrderCounter = async () => {
  try {
    const lastOrder = await Order.findOne({
      order: [["createdAt", "DESC"]],
    });

    if (lastOrder) {
      const lastId = lastOrder.orderId;
      orderCounter = parseInt(lastId.split("-")[1]) + 1;
      console.log(`🚀 Order counter initialized: ${orderCounter}`);
    }
  } catch (error) {
    console.error("❌ Error initializing order counter:", error);
  }
};
