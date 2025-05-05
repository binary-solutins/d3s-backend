// services/cron.js
const cron = require('node-cron');
const db = require('../models');

const checkExpiredPlans = async () => {
  try {
    const expiredHospitals = await db.Hospital.findAll({
      where: {
        plan_time: { [db.Sequelize.Op.lt]: new Date() },
        isVerified: true
      }
    });

    expiredHospitals.forEach(async hospital => {
      await hospital.update({ isVerified: false });
      console.log(`Hospital ${hospital.name} subscription expired`);
    });
  } catch (error) {
    console.error('Error checking expired plans:', error);
  }
};

// Run daily at midnight
cron.schedule('0 0 * * *', checkExpiredPlans);