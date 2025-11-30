module.exports = (sequelize, DataTypes) => {
  const State = sequelize.define('State', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    country_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    }
  }, {
    timestamps: false
  });

  State.associate = (models) => {
    State.belongsTo(models.Country, {
      foreignKey: 'country_id',
      as: 'country'
    });
    State.hasMany(models.City, {
      foreignKey: 'state_id',
      as: 'cities'
    });
  };

  return State;
};