module.exports = (sequelize, DataTypes) => {
    const Report = sequelize.define('Report', {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reportType: {
        type: DataTypes.ENUM('Laboratory', 'Radiology', 'Surgical', 'Pathology', 'Other'),
        allowNull: false,
      },
      fileUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      patientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      hospitalId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      uploadedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID of the user who uploaded this report'
      },
      uploadedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      }
    });
  
    Report.associate = (models) => {
      Report.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
      Report.belongsTo(models.Hospital, { foreignKey: 'hospitalId', as: 'hospital' });
    };
  
    return Report;
  };