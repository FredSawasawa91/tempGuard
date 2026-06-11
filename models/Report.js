const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'custom'),
    defaultValue: 'custom'
  },
  date_range_start: {
    type: DataTypes.DATE,
    allowNull: false
  },
  date_range_end: {
    type: DataTypes.DATE,
    allowNull: false
  },
  file_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  format: {
    type: DataTypes.ENUM('pdf', 'csv', 'json'),
    defaultValue: 'json'
  },
  status: {
    type: DataTypes.ENUM('generating', 'completed', 'failed'),
    defaultValue: 'generating'
  },
  data_summary: {
    type: DataTypes.JSON,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  timestamps: true
});

module.exports = Report;