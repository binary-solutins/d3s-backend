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
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      totalAmount: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'),
        defaultValue: 'Pending'
      },
      paymentMethod: {
        type: DataTypes.ENUM('Credit Card', 'Debit Card', 'Net Banking', 'UPI', 'COD'),
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