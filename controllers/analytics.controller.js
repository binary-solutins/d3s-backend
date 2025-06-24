const { Patient, Hospital, Doctor, Report } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('sequelize');

// 📊 Get comprehensive dashboard data for a hospital
exports.getDashboardData = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    console.log(`📊 Fetching dashboard data for hospital ID: ${hospitalId}`, {
      timestamp: new Date().toISOString()
    });

    // Verify hospital exists
    const hospital = await Hospital.findByPk(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: '❌ Hospital not found' });
    }

    // Get basic counts
    const [totalPatients, totalDoctors, totalReports] = await Promise.all([
      Patient.count({ where: { hospitalId, isDeleted: false } }),
      Doctor.count({ where: { hospitalId } }),
      Report.count({ where: { hospitalId, isDeleted: false } })
    ]);

    // Get recent patients (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentPatients = await Patient.count({
      where: {
        hospitalId,
        isDeleted: false,
        createdAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    // Get recent reports (last 7 days)
    const recentReports = await Report.count({
      where: {
        hospitalId,
        isDeleted: false,
        uploadedAt: { [Op.gte]: sevenDaysAgo }
      }
    });

    // Get patient demographics (gender distribution)
    const genderStats = await Patient.findAll({
      where: { hospitalId, isDeleted: false },
      attributes: [
        'gender',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['gender'],
      raw: true
    });

    // Get age group distribution
    const ageGroups = await Patient.findAll({
      where: { hospitalId, isDeleted: false },
      attributes: [
        [sequelize.literal(`
          CASE
            WHEN age < 18 THEN "0-17"
            WHEN age BETWEEN 18 AND 30 THEN "18-30"
            WHEN age BETWEEN 31 AND 50 THEN "31-50"
            WHEN age BETWEEN 51 AND 70 THEN "51-70"
            ELSE "70+"
          END
        `), 'ageGroup'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.literal('ageGroup')],
      raw: true
    });

    // Get doctor specialization distribution
    const specializationStats = await Doctor.findAll({
      where: { hospitalId },
      attributes: [
        'specialization',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['specialization'],
      raw: true
    });

    // Get report type distribution
    const reportTypeStats = await Report.findAll({
      where: { hospitalId, isDeleted: false },
      attributes: [
        'reportType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['reportType'],
      raw: true
    });

    const dashboardData = {
      overview: {
        totalPatients,
        totalDoctors,
        totalReports,
        recentPatients,
        recentReports
      },
      demographics: {
        genderDistribution: genderStats,
        ageGroupDistribution: ageGroups
      },
      doctors: {
        specializationDistribution: specializationStats
      },
      reports: {
        typeDistribution: reportTypeStats
      }
    };

    console.log(`✅ Dashboard data fetched successfully for hospital ID: ${hospitalId}`, {
      timestamp: new Date().toISOString(),
      dataKeys: Object.keys(dashboardData)
    });

    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('❌ Error fetching dashboard data:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      hospitalId: req.params.hospitalId
    });
    
    res.status(500).json({ 
      error: 'An error occurred while fetching dashboard data',
      details: error.message
    });
  }
};

// 📈 Get patient registration trends (monthly/weekly)
exports.getPatientTrends = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { period = 'monthly' } = req.query; // 'weekly', 'monthly', 'yearly'
    
    let dateFormat, dateGrouping;
    let dateRange = new Date();
    
    switch (period) {
      case 'weekly':
        dateFormat = '%Y-%u'; // Year-Week
        dateGrouping = sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%u');
        dateRange.setDate(dateRange.getDate() - 84); // Last 12 weeks
        break;
      case 'yearly':
        dateFormat = '%Y'; // Year
        dateGrouping = sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y');
        dateRange.setFullYear(dateRange.getFullYear() - 5); // Last 5 years
        break;
      default: // monthly
        dateFormat = '%Y-%m'; // Year-Month
        dateGrouping = sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m');
        dateRange.setMonth(dateRange.getMonth() - 12); // Last 12 months
    }

    const patientTrends = await Patient.findAll({
      where: {
        hospitalId,
        isDeleted: false,
        createdAt: { [Op.gte]: dateRange }
      },
      attributes: [
        [dateGrouping, 'period'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.literal('period')],
      order: [[sequelize.literal('period'), 'ASC']],
      raw: true
    });

    res.status(200).json({
      period,
      trends: patientTrends
    });
  } catch (error) {
    console.error('❌ Error fetching patient trends:', error);
    res.status(500).json({ error: error.message });
  }
};

// 📋 Get report trends and analytics
exports.getReportTrends = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { period = 'monthly' } = req.query;
    
    let dateFormat, dateGrouping;
    let dateRange = new Date();
    
    switch (period) {
      case 'weekly':
        dateFormat = '%Y-%u';
        dateGrouping = sequelize.fn('DATE_FORMAT', sequelize.col('uploadedAt'), '%Y-%u');
        dateRange.setDate(dateRange.getDate() - 84);
        break;
      case 'yearly':
        dateFormat = '%Y';
        dateGrouping = sequelize.fn('DATE_FORMAT', sequelize.col('uploadedAt'), '%Y');
        dateRange.setFullYear(dateRange.getFullYear() - 5);
        break;
      default:
        dateFormat = '%Y-%m';
        dateGrouping = sequelize.fn('DATE_FORMAT', sequelize.col('uploadedAt'), '%Y-%m');
        dateRange.setMonth(dateRange.getMonth() - 12);
    }

    const reportTrends = await Report.findAll({
      where: {
        hospitalId,
        isDeleted: false,
        uploadedAt: { [Op.gte]: dateRange }
      },
      attributes: [
        [dateGrouping, 'period'],
        'reportType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: [sequelize.literal('period'), 'reportType'],
      order: [[sequelize.literal('period'), 'ASC']],
      raw: true
    });

    res.status(200).json({
      period,
      trends: reportTrends
    });
  } catch (error) {
    console.error('❌ Error fetching report trends:', error);
    res.status(500).json({ error: error.message });
  }
};

// 👨‍⚕️ Get detailed doctor analytics
exports.getDoctorAnalytics = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    // Get doctor count by specialization
    const specializationStats = await Doctor.findAll({
      where: { hospitalId },
      attributes: [
        'specialization',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['specialization'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    });

    // Get total doctors
    const totalDoctors = await Doctor.count({ where: { hospitalId } });

    // Get recent additions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentDoctors = await Doctor.count({
      where: {
        hospitalId,
        createdAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    res.status(200).json({
      totalDoctors,
      recentDoctors,
      specializationBreakdown: specializationStats
    });
  } catch (error) {
    console.error('❌ Error fetching doctor analytics:', error);
    res.status(500).json({ error: error.message });
  }
};

// 📊 Get quick stats for widgets
exports.getQuickStats = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalPatients,
      totalDoctors,
      totalReports,
      todayPatients,
      weeklyPatients,
      monthlyPatients,
      todayReports,
      weeklyReports,
      monthlyReports
    ] = await Promise.all([
      // Total counts
      Patient.count({ where: { hospitalId, isDeleted: false } }),
      Doctor.count({ where: { hospitalId } }),
      Report.count({ where: { hospitalId, isDeleted: false } }),
      
      // Today's counts
      Patient.count({
        where: {
          hospitalId,
          isDeleted: false,
          createdAt: { [Op.gte]: startOfDay }
        }
      }),
      
      // Weekly counts
      Patient.count({
        where: {
          hospitalId,
          isDeleted: false,
          createdAt: { [Op.gte]: startOfWeek }
        }
      }),
      
      // Monthly counts
      Patient.count({
        where: {
          hospitalId,
          isDeleted: false,
          createdAt: { [Op.gte]: startOfMonth }
        }
      }),
      
      // Reports - Today
      Report.count({
        where: {
          hospitalId,
          isDeleted: false,
          uploadedAt: { [Op.gte]: startOfDay }
        }
      }),
      
      // Reports - Weekly
      Report.count({
        where: {
          hospitalId,
          isDeleted: false,
          uploadedAt: { [Op.gte]: startOfWeek }
        }
      }),
      
      // Reports - Monthly
      Report.count({
        where: {
          hospitalId,
          isDeleted: false,
          uploadedAt: { [Op.gte]: startOfMonth }
        }
      })
    ]);

    res.status(200).json({
      totals: {
        patients: totalPatients,
        doctors: totalDoctors,
        reports: totalReports
      },
      today: {
        patients: todayPatients,
        reports: todayReports
      },
      thisWeek: {
        patients: weeklyPatients,
        reports: weeklyReports
      },
      thisMonth: {
        patients: monthlyPatients,
        reports: monthlyReports
      }
    });
  } catch (error) {
    console.error('❌ Error fetching quick stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔍 Get recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { limit = 10 } = req.query;

    // Get recent patients
    const recentPatients = await Patient.findAll({
      where: { hospitalId, isDeleted: false },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      attributes: ['id', 'firstName', 'lastName', 'createdAt'],
      raw: true
    });

    // Get recent reports
    const recentReports = await Report.findAll({
      where: { hospitalId, isDeleted: false },
      order: [['uploadedAt', 'DESC']],
      limit: parseInt(limit),
      attributes: ['id', 'title', 'reportType', 'uploadedAt', 'patientId'],
      include: [{
        model: Patient,
        as: 'patient',
        attributes: ['firstName', 'lastName']
      }],
      raw: true
    });

    // Format activities
    const activities = [
      ...recentPatients.map(patient => ({
        type: 'patient_registered',
        message: `New patient registered: ${patient.firstName} ${patient.lastName}`,
        timestamp: patient.createdAt,
        entityId: patient.id
      })),
      ...recentReports.map(report => ({
        type: 'report_uploaded',
        message: `${report.reportType} report uploaded: ${report.title}`,
        timestamp: report.uploadedAt,
        entityId: report.id,
        patientName: report['patient.firstName'] ? 
          `${report['patient.firstName']} ${report['patient.lastName']}` : 'Unknown'
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, parseInt(limit));

    res.status(200).json({
      activities,
      total: activities.length
    });
  } catch (error) {
    console.error('❌ Error fetching recent activities:', error);
    res.status(500).json({ error: error.message });
  }
};