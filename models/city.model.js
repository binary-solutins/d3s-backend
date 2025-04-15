// models/city.js
module.exports = (sequelize, DataTypes) => {
    const City = sequelize.define('City', {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      stateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'States',
          key: 'id'
        }
      }
    });
  
    City.associate = (models) => {
      City.belongsTo(models.State, {
        foreignKey: 'stateId',
        as: 'state'
      });
    };
  
    return City;
  };