module.exports = (sequelize, DataTypes) => {
    const Doctor = sequelize.define('Doctor', {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      specialization: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      designation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    });
  
    Doctor.associate = (models) => {
      Doctor.belongsTo(models.Hospital, {
        foreignKey: 'hospitalId',
        as: 'hospital',
      });
    };
  
    return Doctor;
  };