const { Order } = require('../models');

// Initialize order counter on server start
const initializeOrderCounter = async () => {
  try {
    const lastOrder = await Order.findOne({
      order: [['createdAt', 'DESC']]
    });
    
    if (lastOrder) {
      const lastId = lastOrder.orderId;
      orderCounter = parseInt(lastId.split('-')[1]) + 1;
      console.log(`🚀 Order counter initialized: ORD-${orderCounter.toString().padStart(6, '0')}`);
    } else {
      orderCounter = 1;
      console.log('🚀 No existing orders. Starting new order sequence');
    }
  } catch (error) {
    console.error('❌ Error initializing order counter:', error);
    orderCounter = 1;
  }
};

module.exports = initializeOrderCounter;