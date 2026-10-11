// One-off migration for the gas-detection feature.
// Adds Sensor.has_gas_sensor/last_gas_detected/last_gas_at,
// Reading.gas_detected, and rebuilds Alerts so temperature/threshold
// are nullable and type allows GAS_DETECTED.
// Safe to run multiple times (checks pragma table_info first).
// Runs automatically at boot after sequelize.sync().

async function migrateGas(sequelize) {
  const qi = sequelize.getQueryInterface();

  const hasColumn = async (table, column) => {
    const cols = await qi.describeTable(table).catch(() => null);
    if (cols) return !!cols[column];
    // Fallback via pragma for odd table names
    const [rows] = await sequelize.query(`PRAGMA table_info("${table}")`);
    return rows.some((r) => r.name === column);
  };

  // --- Sensors ---
  if (!(await hasColumn("Sensors", "has_gas_sensor"))) {
    await sequelize.query(
      'ALTER TABLE "Sensors" ADD COLUMN "has_gas_sensor" BOOLEAN DEFAULT 0'
    );
    console.log("[Migrate] Added Sensors.has_gas_sensor");
  }
  if (!(await hasColumn("Sensors", "last_gas_detected"))) {
    await sequelize.query(
      'ALTER TABLE "Sensors" ADD COLUMN "last_gas_detected" BOOLEAN'
    );
    console.log("[Migrate] Added Sensors.last_gas_detected");
  }
  if (!(await hasColumn("Sensors", "last_gas_at"))) {
    await sequelize.query(
      'ALTER TABLE "Sensors" ADD COLUMN "last_gas_at" DATETIME'
    );
    console.log("[Migrate] Added Sensors.last_gas_at");
  }

  // --- Readings ---
  if (!(await hasColumn("Readings", "gas_detected"))) {
    await sequelize.query(
      'ALTER TABLE "Readings" ADD COLUMN "gas_detected" BOOLEAN'
    );
    console.log("[Migrate] Added Readings.gas_detected");
  }

  // --- Alerts: temperature/threshold must become nullable ---
  const alertCols = await qi.describeTable("Alerts").catch(() => null);
  if (alertCols) {
    const tempNullable = alertCols.temperature
      ? alertCols.temperature.allowNull
      : true;
    const threshNullable = alertCols.threshold
      ? alertCols.threshold.allowNull
      : true;
    if (tempNullable === false || threshNullable === false) {
      console.log("[Migrate] Rebuilding Alerts table (nullable temp/threshold)...");
      await sequelize.query("PRAGMA foreign_keys=OFF");
      try {
        await sequelize.query("DROP TABLE IF EXISTS Alerts_backup");
        await sequelize.query("ALTER TABLE Alerts RENAME TO Alerts_backup");
        // Recreate via model definition (GAS_DETECTED + nullable)
        const Alert = require("../models/Alert");
        await Alert.sync({ force: false });
        await sequelize.query(
          `INSERT INTO Alerts (id, type, message, temperature, threshold, acknowledged, acknowledged_at, acknowledged_by, sensor_id, createdAt, updatedAt)
           SELECT id, type, message, temperature, threshold, acknowledged, acknowledged_at, acknowledged_by, sensor_id, createdAt, updatedAt FROM Alerts_backup`
        );
        await sequelize.query("DROP TABLE Alerts_backup");
        console.log("[Migrate] Alerts rebuilt, rows preserved");
      } finally {
        await sequelize.query("PRAGMA foreign_keys=ON");
      }
    }
  }
}

module.exports = { migrateGas };
