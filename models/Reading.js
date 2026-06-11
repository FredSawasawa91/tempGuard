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
  }
}, {
  timestamps: true
});

module.exports = Reading;

