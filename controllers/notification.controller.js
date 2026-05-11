const db = require('../models');
const Notification = db.Notification;

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.doctorId;
    const userType = req.role;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    const notifications = await Notification.findAll({
      where: {
        userId,
        userType,
      },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const unreadCount = await Notification.count({
      where: {
        userId,
        userType,
        isRead: false
      }
    });

    res.status(200).json({
      notifications,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id || req.doctorId;

    const notification = await Notification.findOne({
      where: { id, userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.update({ isRead: true });

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.doctorId;
    const userType = req.role;

    await Notification.update(
      { isRead: true },
      { where: { userId, userType, isRead: false } }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
