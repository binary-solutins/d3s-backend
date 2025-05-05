// models/admin.model.js
module.exports = (sequelize, DataTypes) => {
    const Admin = sequelize.define('Admin', {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false
      },
      resetToken: {
        type: DataTypes.STRING
      },
      resetTokenExpiry: {
        type: DataTypes.DATE
      }
    });
    return Admin;
  };