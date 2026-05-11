module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userType: {
      type: DataTypes.ENUM('doctor', 'hospital', 'admin'),
      allowNull: false,
      defaultValue: 'doctor'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING, // e.g., 'REPORT_ASSIGNED', 'REPORT_REVIEWED'
      defaultValue: 'GENERAL'
    },
    relatedId: {
      type: DataTypes.INTEGER, // e.g., reportId
      allowNull: true
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    }
  });

  return Notification;
};
