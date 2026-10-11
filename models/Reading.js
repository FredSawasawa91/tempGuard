const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reading = sequelize.define('Reading', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  temperature: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  gas_detected: {
    // NULL = sensor has no gas hardware (temp-only); 0/1 = gas sensor value
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: null,
  }
}, {
  timestamps: true
});

module.exports = Reading;

