module.exports = (sequelize, DataTypes) => {
    const Product = sequelize.define('Product', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      price: {
        type: DataTypes.FLOAT,
        allowNull: false
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      rating: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
      },
      reviewCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      images: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      features: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      specifications: {
        type: DataTypes.JSON,
        defaultValue: {}
      },
      highlights: {
        type: DataTypes.JSON,
        defaultValue: []
      }
    });
  
    return Product;
  };