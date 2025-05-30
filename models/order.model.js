module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    orderId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    customerPhone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    billingAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: 'Unit price of the product at time of order'
    },
    itemTotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: 'quantity * price for this item'
    },
    subtotal: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: 'Order subtotal (same across all items in same order)'
    },
    tax: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      comment: 'Tax amount (same across all items in same order)'
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: 'Final order total (same across all items in same order)'
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'),
      defaultValue: 'Pending'
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  });

  Order.associate = (models) => {
    Order.belongsTo(models.Product, {
      foreignKey: 'productId',
      as: 'product'
    });
  };

  return Order;
};