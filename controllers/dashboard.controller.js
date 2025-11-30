// controllers/dashboard.controller.js
const db = require('../models');
const { Op, Sequelize } = require('sequelize');

exports.getAdminDashboard = async (req, res) => {
  try {
    // Check if user is hospital or admin
    const isHospital = req.role === 'hospital';
    const hospitalId = req.hospitalId;
    
    // Build where clauses based on role
    const hospitalWhere = isHospital ? { id: hospitalId } : {};
    const patientWhere = isHospital ? { hospitalId } : {};
    const reportWhere = isHospital ? { hospitalId, isDeleted: false } : { isDeleted: false };
    const doctorWhere = isHospital ? { hospitalId } : {};

    const [
      totalHospitals,
      totalPatients,
      totalReports,
      totalDoctors,
      verifiedHospitals
    ] = await Promise.all([
      isHospital ? Promise.resolve(1) : db.Hospital.count(),
      db.Patient.count({ where: patientWhere }),
      db.Report.count({ where: reportWhere }),
      db.Doctor.count({ where: doctorWhere }),
      isHospital ? Promise.resolve(0) : db.Hospital.count({ 
        where: { isVerified: true }
      })
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const hospitalGrowth = isHospital ? [] : await db.Hospital.findAll({
      attributes: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'year'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: sixMonthsAgo
        },
        ...hospitalWhere
      },
      group: [
        Sequelize.fn('YEAR', Sequelize.col('createdAt')),
        Sequelize.fn('MONTH', Sequelize.col('createdAt'))
      ],
      order: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'ASC'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'ASC']
      ],
      raw: true
    });

    const patientGrowth = await db.Patient.findAll({
      attributes: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'year'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: sixMonthsAgo
        },
        ...patientWhere
      },
      group: [
        Sequelize.fn('YEAR', Sequelize.col('createdAt')),
        Sequelize.fn('MONTH', Sequelize.col('createdAt'))
      ],
      order: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'ASC'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'ASC']
      ],
      raw: true
    });

    const doctorGrowth = await db.Doctor.findAll({
      attributes: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'year'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: sixMonthsAgo
        },
        ...doctorWhere
      },
      group: [
        Sequelize.fn('YEAR', Sequelize.col('createdAt')),
        Sequelize.fn('MONTH', Sequelize.col('createdAt'))
      ],
      order: [
        [Sequelize.fn('YEAR', Sequelize.col('createdAt')), 'ASC'],
        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'ASC']
      ],
      raw: true
    });

    const reportTrends = await db.Report.findAll({
      attributes: [
        [Sequelize.fn('YEAR', Sequelize.col('uploadedAt')), 'year'],
        [Sequelize.fn('MONTH', Sequelize.col('uploadedAt')), 'month'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        uploadedAt: {
          [Op.gte]: sixMonthsAgo
        },
        ...reportWhere
      },
      group: [
        Sequelize.fn('YEAR', Sequelize.col('uploadedAt')),
        Sequelize.fn('MONTH', Sequelize.col('uploadedAt'))
      ],
      order: [
        [Sequelize.fn('YEAR', Sequelize.col('uploadedAt')), 'ASC'],
        [Sequelize.fn('MONTH', Sequelize.col('uploadedAt')), 'ASC']
      ],
      raw: true
    });

    res.json({
      summary: {
        totalHospitals,
        totalPatients,
        totalReports,
        totalDoctors,
        verifiedHospitals,
      },
      trends: {
        hospitalGrowth: hospitalGrowth.map(item => ({
          month: `${item.year}-${String(item.month).padStart(2, '0')}`,
          count: parseInt(item.count)
        })),
        patientGrowth: patientGrowth.map(item => ({
          month: `${item.year}-${String(item.month).padStart(2, '0')}`,
          count: parseInt(item.count)
        })),
        doctorGrowth: doctorGrowth.map(item => ({
          month: `${item.year}-${String(item.month).padStart(2, '0')}`,
          count: parseInt(item.count)
        })),
        reportTrends: reportTrends.map(item => ({
          month: `${item.year}-${String(item.month).padStart(2, '0')}`,
          count: parseInt(item.count)
        }))
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};