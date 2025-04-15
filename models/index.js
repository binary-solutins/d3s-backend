const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

// 🌐 Clever Cloud MySQL connection
const sequelize = new Sequelize(
  'bwrwfaltw8djchryzsli',         // DB_NAME
  'uk6a3p01ehdlwgyp',             // DB_USER
  'eXop27L51bIEeGPlsSu8',         // DB_PASSWORD
  {
    host: 'bwrwfaltw8djchryzsli-mysql.services.clever-cloud.com', // DB_HOST
    dialect: 'mysql',
    port: 3306,
    logging: console.log, // Set to true if you want to see SQL logs
  }
);

// ✅ Load models
fs.readdirSync(__dirname)
  .filter(file => file !== basename && file.endsWith('.js'))
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// ✅ Run associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) db[modelName].associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
