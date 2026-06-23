const express = require("express");
const cors = require('cors');
const sequelize = require("./config/database");
const apiRoutes = require("./routes/api");
const Reading = require("./models/Reading");
const Sensor = require("./models/Sensor");
const User = require("./models/User");
const Report = require("./models/Report");
const MaintenanceTask = require("./models/maintenance");
const { startMaintenanceAlertJob } = require('./jobs/maintenanceAlertJob');
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(cors()); // Enable CORS for all routes

// =================================================================
// MODEL RELATIONS (ASSOCIATIONS)
// =================================================================
User.hasMany(Sensor, { foreignKey: "user_id", onDelete: "CASCADE" });
Sensor.belongsTo(User, { foreignKey: "user_id" });

Sensor.hasMany(Reading, { foreignKey: "sensor_id", onDelete: "CASCADE" });
Reading.belongsTo(Sensor, { foreignKey: "sensor_id" });

Sensor.hasMany(MaintenanceTask, {
  foreignKey: "sensor_id",
  onDelete: "CASCADE",
});
MaintenanceTask.belongsTo(Sensor, { foreignKey: "sensor_id" });

User.hasMany(Report, { foreignKey: "user_id", onDelete: "CASCADE" });
Report.belongsTo(User, { foreignKey: "user_id" });


app.use("/api", apiRoutes);

// Public reading endpoint remains separate
app.post("/api/readings", async (req, res) => {
  try {
    const { sensor_id, temperature, latitude, longitude } = req.body;

    if (
      !sensor_id ||
      temperature === undefined ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const sensorExists = await Sensor.findByPk(sensor_id);
    if (!sensorExists) {
      return res.status(404).json({
        success: false,
        message: `Sensor profile '${sensor_id}' not found. Please register the hardware profile first.`,
      });
    }

    const newReading = await Reading.create({
      sensor_id,
      temperature,
      latitude,
      longitude,
    });

    // Update sensor's last reading info
    await sensorExists.update({
      last_reading_at: new Date(),
      last_reading_value: temperature,
      latitude: latitude || sensorExists.latitude,
      longitude: longitude || sensorExists.longitude,
    });

    return res.status(201).json({
      success: true,
      message: "Telemetry log saved successfully",
      data: newReading,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

// Sync Database Schema and Boot Server
// For SQLite, use these options
sequelize
  .sync({ force: false, alter: false }) // Use alter: false to avoid issues
  .then(async () => {
    console.log("Database synced successfully");
    
    // Create default admin user if not exists
    const User = require("./models/User");
    const adminExists = await User.findOne({ where: { username: "admin" } });
    if (!adminExists) {
      await User.create({
        username: "admin",
        email: "admin@example.com",
        password: "admin123",
        role: "admin",
        fullName: "System Administrator",
      });
      console.log("Default admin user created: username='admin', password='admin123'");
    }
    
    // Start the maintenance alert job
    startMaintenanceAlertJob();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Database sync error:", err);
  });

