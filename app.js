// 🚀 Import Dependencies
const express = require('express');
const cors = require('cors');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');
require('dotenv').config();

const app = express();

// 📦 Load Models
const db = require('./models');

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
app.use(express.json());

// 🛣️ API Routes
app.use('/api/hospitals', require('./routes/hospital.route'));
app.use('/api/doctors', require('./routes/doctor.route'));
app.use('/api/patients', require('./routes/patient.route'));
app.use('/api', require('./routes/location.route'));

// 📚 Swagger UI
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// 🧩 Database Sync
db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ Database synced successfully');
  })
  .catch(err => {
    console.error('❌ Error syncing database:', err);
  });

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running at: http://localhost:${PORT}`);
});
