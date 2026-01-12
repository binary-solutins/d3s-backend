// 🚀 Import Dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');
const initializeOrderCounter = require('./scripts/initOrderCounter');
require('./services/cron');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// 📦 Load Models
const db = require('./models');
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  next();
});
// 🧠 Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'D3S API',
      version: '1.0.0',
      description: '🏥 Hospital-Doctor-Patient Management System',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '🌐 Development server',
      },

      {
        url: 'https://d3s-backend-dva9.onrender.com',
        description: '🌐 Testing server',
      },
      {
        url: 'https://d3s-backend-hwbxccckgcdbdgfr.centralindia-01.azurewebsites.net',
        description: '🌐 Production server',
      },

    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./routes/*.js'], // 📄 Path to route API docs
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// 🌐 Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 🛣️ API Routes
app.use('/api/hospitals', require('./routes/hospital.route'));
app.use('/api/doctors', require('./routes/doctor.route'));
app.use('/api/patients', require('./routes/patient.route'));
app.use('/api', require('./routes/location.route'));
app.use('/api/reports', require('./routes/report.route'));
app.use('/api/admin', require('./routes/admin.route'));
app.use('/api', require('./routes/dashboard.route'));
app.use('/api/orders', require('./routes/order.route'));
app.use('/api/analytics', require('./routes/analytics.route'));
app.use('/api/appointments', require('./routes/appointment.route'));
app.use('/api/offline', require('./routes/offlineSync.route'));
// 📚 Swagger UI
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// 🧩 Database Sync
// IMPORTANT (prod safety):
// - Full `alter: true` can fail on MySQL if there is existing inconsistent FK data (e.g. Doctors.hospitalId not matching Hospitals.id).
// - For this change we only need to add optional columns to Patients, so we keep global sync safe and only alter the Patient table.
db.sequelize.sync({ alter: false })
  .then(async () => {
    try {
      // Apply schema changes only to Patient (adds new optional columns without touching other tables/FKs)
      if (db.Patient?.sync) {
        await db.Patient.sync({ alter: true });
        console.log('✅ Patient table altered successfully');
      }
      console.log('✅ Database synced successfully');
    } catch (err) {
      console.error('❌ Error altering Patient table:', err);
      console.log('✅ Database synced successfully (without Patient alter)');
    }
  })
  .catch(err => {
    console.error('❌ Error syncing database:', err);
  });

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await initializeOrderCounter();
  console.log(`🟢 Server running at: http://localhost:${PORT}`);
});
