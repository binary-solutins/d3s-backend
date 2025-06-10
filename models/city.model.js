module.exports = (sequelize, DataTypes) => {
  const City = sequelize.define('City', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    state_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'cities',
    timestamps: false
  });

  City.associate = (models) => {
    City.belongsTo(models.State, {
      foreignKey: 'state_id',
      as: 'state'
    });
    // If you want direct access to country through city
    City.belongsTo(models.Country, {
      foreignKey: 'country_id',
      as: 'country'
    });
  };

  return City;
};
