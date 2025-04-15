// models/state.js
module.exports = (sequelize, DataTypes) => {
    const State = sequelize.define('State', {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      stateCode: {
        type: DataTypes.STRING(5),
        allowNull: false
      },
      countryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Countries',
          key: 'id'
        }
      }
    });
  
    State.associate = (models) => {
      State.belongsTo(models.Country, {
        foreignKey: 'countryId',
        as: 'country'
      });
      State.hasMany(models.City, {
        foreignKey: 'stateId',
        as: 'cities'
      });
    };
  
    return State;
  };