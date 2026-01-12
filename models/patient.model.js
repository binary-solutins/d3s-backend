module.exports = (sequelize, DataTypes) => {
  const Patient = sequelize.define('Patient', {
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    height: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    contact: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    gender: {
      type: DataTypes.ENUM('Male', 'Female', 'Other'),
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    adharNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    hospitalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Optional Breast Cancer Screening Questions (nullable so existing data isn't affected)
    familyHistoryOfCancer: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    breastLump: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    breastPain: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    changeInBreastAppearance: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    breastSkinChanges: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    nippleDischarge: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    nippleSymptoms: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    previousBreastScreening: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    previousBreastProceduresOrAbnormalReport: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }
  });
  
  Patient.associate = (models) => {
    Patient.belongsTo(models.Hospital, { foreignKey: 'hospitalId', as: 'hospital' });
  };
  
  return Patient;
};