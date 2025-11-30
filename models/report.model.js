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
      type: DataTypes.ENUM(
        'Laboratory',
        'Radiology',
        'Surgical',
        'Pathology',
        'Other'
      ),
      allowNull: false,
    },

    // ORIGINAL uploaded PDF
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

    // ANNOTATION OUTPUT (NEW)
    annotatedFileUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL of the annotated PDF file',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Doctor remarks for report',
    },

    status: {
      type: DataTypes.ENUM('pending', 'assigned', 'reviewed'),
      defaultValue: 'pending',
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when doctor reviewed the report',
    },

    doctorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID of the doctor who reviewed this report',
    },
    assignedDoctorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID of the doctor assigned by hospital',
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
    },
    uploadedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isChecked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  });

  Report.associate = (models) => {
    Report.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    Report.belongsTo(models.Hospital, { foreignKey: 'hospitalId', as: 'hospital' });
    Report.belongsTo(models.Doctor, { foreignKey: 'doctorId', as: 'doctor' });
    Report.belongsTo(models.Doctor, { foreignKey: 'assignedDoctorId', as: 'assignedDoctor' });
  };

  return Report;
};
