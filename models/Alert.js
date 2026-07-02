const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Alert = sequelize.define("Alert", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  type: { type: DataTypes.ENUM("HIGH_TEMP", "LOW_TEMP"), allowNull: false },
  message: { type: DataTypes.STRING, allowNull: false },
  temperature: { type: DataTypes.FLOAT, allowNull: false },
  threshold: { type: DataTypes.FLOAT, allowNull: false },
  acknowledged: { type: DataTypes.BOOLEAN, defaultValue: false },
  acknowledged_at: { type: DataTypes.DATE, allowNull: true },
  acknowledged_by: { type: DataTypes.INTEGER, allowNull: true },
}, { timestamps: true });

module.exports = Alert;
