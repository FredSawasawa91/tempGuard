// const { Sequelize } = require("sequelize");
// const path = require("path");

// const sequelize = new Sequelize({
//   dialect: "sqlite",
//   storage: path.join(__dirname, "../database.sqlite"), // DB file

//   logging: false,

//   pool: {
//     max: 5,
//     min: 0,
//     idle: 10000,
//   },
// });

// module.exports = sequelize;




const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false, // Set to console.log to see SQL queries
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;