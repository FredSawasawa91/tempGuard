const express = require("express");
const cors = require('cors');
const sequelize = require("./config/database");
const apiRoutes = require("./routes/api");
const Reading = require("./models/Reading");
const Sensor = require("./models/Sensor");
const User = require("./models/User");
const Report = require("./models/Report");
const MaintenanceTask = require("./models/maintenance");
const Alert = require("./models/Alert");
//const { startMaintenanceAlertJob } = require('./jobs/maintenanceAlertJob');
const { seedTestDataIfEmpty, shouldSeed } = require("./utils/seedTestData");
const { migrateGas } = require("./utils/migrateGas");
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

Sensor.hasMany(Alert, { foreignKey: "sensor_id", onDelete: "CASCADE" });
Alert.belongsTo(Sensor, { foreignKey: "sensor_id" });


app.use("/api", apiRoutes);

// Public reading endpoint remains separate
app.post("/api/readings", async (req, res) => {
  try {
    const { sensor_id, temperature, latitude, longitude } = req.body;
    // Gas binary: 0/1/true/false/"0"/"1"; optional, defaults below
    const gasRaw =
      req.body.gas_detected !== undefined
        ? req.body.gas_detected
        : req.body.gas;

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

    // Gas: temp-only sensors always store NULL (no gas hardware) so a 0
    // is never confused with "lack of gas parameter". Gas-capable sensors
    // default a missing field to 0 (no gas detected).
    let gas_detected = null;
    if (sensorExists.has_gas_sensor) {
      if (gasRaw === undefined || gasRaw === null || gasRaw === "") {
        gas_detected = false;
      } else if (
        gasRaw === true ||
        gasRaw === 1 ||
        gasRaw === "1" ||
        (typeof gasRaw === "string" && gasRaw.toLowerCase() === "true")
      ) {
        gas_detected = true;
      } else if (
        gasRaw === false ||
        gasRaw === 0 ||
        gasRaw === "0" ||
        (typeof gasRaw === "string" && gasRaw.toLowerCase() === "false")
      ) {
        gas_detected = false;
      } else {
        return res.status(400).json({
          success: false,
          message: "gas_detected must be 0 or 1",
        });
      }
    }

    const newReading = await Reading.create({
      sensor_id,
      temperature,
      latitude,
      longitude,
      gas_detected,
    });

    // Update sensor's last reading info
    const sensorUpdate = {
      last_reading_at: new Date(),
      last_reading_value: temperature,
      latitude: latitude || sensorExists.latitude,
      longitude: longitude || sensorExists.longitude,
    };
    if (gas_detected !== null) {
      sensorUpdate.last_gas_detected = gas_detected;
      sensorUpdate.last_gas_at = new Date();
    }
    await sensorExists.update(sensorUpdate);

    // Trigger alert if temperature is out of range
    if (temperature > sensorExists.max_temp) {
      await Alert.create({ sensor_id, type: "HIGH_TEMP", message: "Temp High, " + temperature + "\u00B0C", temperature, threshold: sensorExists.max_temp });
    } else if (temperature < sensorExists.min_temp) {
      await Alert.create({ sensor_id, type: "LOW_TEMP", message: "Temp Low, " + temperature + "\u00B0C", temperature, threshold: sensorExists.min_temp });
    }

    // Gas always alerts on 1 (only gas-capable sensors reach here with 0/1)
    if (gas_detected === true) {
      await Alert.create({ sensor_id, type: "GAS_DETECTED", message: "Gas detected", temperature: null, threshold: null });
    }

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
  .sync({ force: false, alter: false })
  .then(async () => {
    console.log("Database synced successfully");

    // Gas-detection migration (adds columns to pre-existing DBs; no-op otherwise)
    try {
      await migrateGas(sequelize);
    } catch (e) {
      console.error("[Migrate] gas migration failed:", e.message);
    }
    
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
    // Warn while the well-known bootstrap password is still in use
    // (self-registration is disabled, so this account is the only way in).
    try {
      const admin = await User.findOne({ where: { username: "admin" } });
      if (admin && await admin.validPassword("admin123")) {
        console.warn("[Security] Default admin password 'admin123' is still active - change it via Profile > Change Password immediately.");
      }
    } catch (e) {
      console.error("[Security] default-password check failed:", e.message);
    }
    
    // Start the maintenance alert job
    //startMaintenanceAlertJob();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    // Background auto-seed: past-5-months test data on first run only.
    // Non-blocking (server already listening) + terminal progress inside.
    // Gate: SEED_TEST_DATA=true forces on, =false forces off,
    // unset defaults to on except in production. SEED_FORCE=true reseeds.
    setImmediate(async () => {
      try {
        if (await shouldSeed()) {
          console.log("[Seed] No sensor data found - generating test data in background...");
          const admin = await User.findOne({ where: { username: "admin" } });
          await seedTestDataIfEmpty(admin ? admin.id : null);
        } else {
          console.log("[Seed] Skipped (sensor data exists or seeding disabled)");
        }
      } catch (e) {
        console.error("[Seed] background seed failed:", e.message);
      }
    });
  })
  .catch((err) => {
    console.error("Database sync error:", err);
  });

