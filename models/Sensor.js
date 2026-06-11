const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Sensor = sequelize.define(
  "Sensor",
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: "Temperature" },
    min_temp: { type: DataTypes.FLOAT, defaultValue: 0.0 },
    max_temp: { type: DataTypes.FLOAT, allowNull: false },
    status: {
      type: DataTypes.ENUM("active", "inactive", "maintenance"),
      defaultValue: "active",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    location_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_reading_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_reading_value: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = Sensor;

// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/database");

// const Sensor = sequelize.define(
//   "Sensor",
//   {
//     id: { type: DataTypes.STRING, primaryKey: true },
//     name: { type: DataTypes.STRING, allowNull: false },
//     type: { type: DataTypes.STRING, defaultValue: "Temperature" },
//     min_temp: { type: DataTypes.FLOAT, defaultValue: 0.0 },
//     max_temp: { type: DataTypes.FLOAT, allowNull: false }, // Your screen template references a 38°C threshold
//     status: {
//       type: DataTypes.ENUM("active", "inactive", "maintenance"),
//       defaultValue: "active",
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// module.exports = Sensor;
