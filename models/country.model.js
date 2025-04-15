// models/country.js
module.exports = (sequelize, DataTypes) => {
    const Country = sequelize.define('Country', {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      isoCode: {
        type: DataTypes.STRING(3),
        allowNull: false,
        unique: true
      },
      phoneCode: {
        type: DataTypes.STRING(5),
        allowNull: false
      }
    });
  
    Country.associate = (models) => {
      Country.hasMany(models.State, {
        foreignKey: 'countryId',
        as: 'states'
      });
    };
  
    return Country;
  };