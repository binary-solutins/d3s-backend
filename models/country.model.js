module.exports = (sequelize, DataTypes) => {
  const Country = sequelize.define('Country', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    shortname: {
      type: DataTypes.STRING(3),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    phonecode: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    timestamps: false,
  });

  Country.associate = (models) => {
    Country.hasMany(models.State, {
      foreignKey: 'country_id',
      as: 'states',
    });
    Country.hasMany(models.City, {
      foreignKey: 'country_id',
      as: 'cities',
    });
  };

  return Country;
};
