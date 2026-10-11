const Sensor = require("../models/Sensor");
const Reading = require("../models/Reading");
const Alert = require("../models/Alert");
const User = require("../models/User");
const Report = require("../models/Report");
const MaintenanceTask = require("../models/maintenance");
const { Op } = require("sequelize");

// Associations must exist before bulkCreate, otherwise Sequelize drops
// FK fields (sensor_id/user_id) silently. Mirrors server.js.
User.hasMany(Sensor, { foreignKey: "user_id", onDelete: "CASCADE" });
Sensor.belongsTo(User, { foreignKey: "user_id" });
Sensor.hasMany(Reading, { foreignKey: "sensor_id", onDelete: "CASCADE" });
Reading.belongsTo(Sensor, { foreignKey: "sensor_id" });
Sensor.hasMany(MaintenanceTask, { foreignKey: "sensor_id", onDelete: "CASCADE" });
MaintenanceTask.belongsTo(Sensor, { foreignKey: "sensor_id" });
User.hasMany(Report, { foreignKey: "user_id", onDelete: "CASCADE" });
Report.belongsTo(User, { foreignKey: "user_id" });
Sensor.hasMany(Alert, { foreignKey: "sensor_id", onDelete: "CASCADE" });
Alert.belongsTo(Sensor, { foreignKey: "sensor_id" });

// 5 real locations within Blantyre, Malawi
const SENSORS = [
  {
    id: "BTY-001",
    name: "Chichiri Sensor",
    type: "Temperature",
    min_temp: 10,
    max_temp: 35,
    status: "active",
    latitude: -15.8012,
    longitude: 35.0235,
    location_name: "Chichiri, Blantyre",
    description: "Test sensor - Chichiri (Museum / Shoprite area)",
    offset: -0.4,
  },
  {
    id: "BTY-002",
    name: "Limbe Sensor",
    type: "Temperature",
    min_temp: 10,
    max_temp: 35,
    status: "active",
    latitude: -15.8097,
    longitude: 35.0513,
    location_name: "Limbe Market, Blantyre",
    description: "Test sensor - Limbe commercial area",
    offset: 0.3,
    has_gas_sensor: true,
  },
  {
    id: "BTY-003",
    name: "Soche Sensor",
    type: "Temperature",
    min_temp: 10,
    max_temp: 35,
    status: "active",
    latitude: -15.8306,
    longitude: 35.0211,
    location_name: "Soche Hill, Blantyre",
    description: "Test sensor - Soche residential area",
    offset: 0,
  },
  {
    id: "BTY-004",
    name: "CBD Sensor",
    type: "Temperature",
    min_temp: 10,
    max_temp: 35,
    status: "active",
    latitude: -15.7861,
    longitude: 35.0058,
    location_name: "Victoria Ave, Blantyre CBD",
    description: "Test sensor - Blantyre city centre",
    offset: 0.5,
    has_gas_sensor: true,
  },
  {
    id: "BTY-005",
    name: "Chileka Sensor",
    type: "Temperature",
    min_temp: 10,
    max_temp: 35,
    status: "active",
    latitude: -15.6791,
    longitude: 34.9709,
    location_name: "Chileka Airport, Blantyre",
    description: "Test sensor - Chileka Airport area",
    offset: -0.2,
  },
];

// Seasonal mid-point temps for Blantyre (real climate:
// cool/dry Jun-Jul, warming Aug, hot Sep-Oct, warm wet Nov-Apr)
function seasonalBase(month) {
  const base = {
    0: 22.0, // Jan
    1: 22.0, // Feb
    2: 21.0, // Mar
    3: 19.0, // Apr
    4: 18.0, // May
    5: 15.5, // Jun
    6: 15.5, // Jul
    7: 19.0, // Aug
    8: 23.0, // Sep
    9: 24.5, // Oct
    10: 23.0, // Nov
    11: 22.0, // Dec
  };
  return base[month] ?? 20;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function shouldSeed() {
  return (async () => {
    if (process.env.SEED_FORCE === "true") return true;
    try {
      const sensorCount = await Sensor.count();
      const readingCount = await Reading.count();
      if (sensorCount > 0 || readingCount > 0) return false;
    } catch (e) {
      // If tables don't exist yet (pre-sync), let caller decide after sync.
      return false;
    }
    if (process.env.SEED_TEST_DATA === "true") return true;
    if (process.env.SEED_TEST_DATA === "false") return false;
    // Default: seed in dev, never in production unless explicitly enabled.
    return process.env.NODE_ENV !== "production";
  })();
}

async function seedTestDataIfEmpty(adminId, opts = {}) {
  const force = opts.force || process.env.SEED_FORCE === "true";
  const verbose = process.env.SEED_VERBOSE === "true";

  if (!force) {
    const sensors = await Sensor.count();
    const readings = await Reading.count();
    if (sensors > 0 || readings > 0) {
      console.log(
        `[Seed] Skipped (data exists: ${sensors} sensors, ${readings} readings)`
      );
      return { skipped: true };
    }
  } else {
    console.log("[Seed] Force mode: clearing existing test data...");
    await Reading.destroy({ where: {} });
    await Alert.destroy({ where: {} });
    await Sensor.destroy({ where: {} });
  }

  // Resolve admin owner for Sensor.user_id FK
  let ownerId = adminId;
  if (!ownerId) {
    const admin = await User.findOne({ where: { username: "admin" } });
    ownerId = admin ? admin.id : null;
  }

  // Dynamic range: 5 calendar months back -> current hour (includes today)
  const end = new Date();
  end.setMinutes(0, 0, 0);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 5);
  start.setHours(0, 0, 0, 0);

  const hours = [];
  for (let t = new Date(start); t <= end; t.setHours(t.getHours() + 1)) {
    hours.push(new Date(t));
  }

  const total = hours.length * SENSORS.length;
  console.log(
    `[Seed] Seeding test data: ${SENSORS.length} sensors x ${hours.length} hourly readings = ${total.toLocaleString()} rows`
  );
  console.log(
    `[Seed] Range: ${start.toISOString()} -> ${end.toISOString()}`
  );

  const t0 = Date.now();
  let processed = 0;
  let nextMilestone = 25;
  const readingsBatch = [];
  const alertsBatch = [];

  // Upsert sensors first
  for (const s of SENSORS) {
    const { offset, ...row } = s;
    await Sensor.upsert({
      ...row,
      has_gas_sensor: !!s.has_gas_sensor,
      user_id: ownerId,
    });
  }
  console.log("[Seed] Sensors upserted (5/5)");

  for (let si = 0; si < SENSORS.length; si++) {
    const s = SENSORS[si];
    for (const ts of hours) {
      const month = ts.getMonth();
      const hour = ts.getHours();
      // Daily cycle: coldest ~05:00, hottest ~14:00
      const diurnal = 5.5 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
      const noise = (Math.random() - 0.5) * 3; // ±1.5
      let temp = seasonalBase(month) + diurnal + noise + s.offset;

      // ~2.5% intentional breaches (biased by season)
      const r = Math.random();
      const hotSeason = month === 8 || month === 9 || month === 10;
      const coldSeason = month === 5 || month === 6;
      if (r < 0.025) {
        if (hotSeason || (!coldSeason && Math.random() < 0.7)) {
          temp = 36 + Math.random() * 3.5; // 36-39.5 HIGH_TEMP
        } else {
          temp = 6 + Math.random() * 3.5; // 6-9.5 LOW_TEMP
        }
      }
      temp = round2(temp);

      // GPS drift ±0.0008 (stays in Blantyre)
      const lat = round2(
        s.latitude + (Math.random() - 0.5) * 0.0016
      );
      const lng = round2(
        s.longitude + (Math.random() - 0.5) * 0.0016
      );

      readingsBatch.push({
        sensor_id: s.id,
        temperature: temp,
        latitude: lat,
        longitude: lng,
        // Temp-only sensors store NULL; gas sensors store 0/1 (~1% events)
        gas_detected: s.has_gas_sensor ? Math.random() < 0.01 : null,
        createdAt: new Date(ts),
        updatedAt: new Date(ts),
      });

      if (s.has_gas_sensor && readingsBatch[readingsBatch.length - 1].gas_detected) {
        alertsBatch.push({
          sensor_id: s.id,
          type: "GAS_DETECTED",
          message: "Gas detected",
          temperature: null,
          threshold: null,
          createdAt: new Date(ts),
          updatedAt: new Date(ts),
        });
      }

      if (temp > s.max_temp) {
        alertsBatch.push({
          sensor_id: s.id,
          type: "HIGH_TEMP",
          message: `Temp High, ${temp}°C`,
          temperature: temp,
          threshold: s.max_temp,
          createdAt: new Date(ts),
          updatedAt: new Date(ts),
        });
      } else if (temp < s.min_temp) {
        alertsBatch.push({
          sensor_id: s.id,
          type: "LOW_TEMP",
          message: `Temp Low, ${temp}°C`,
          temperature: temp,
          threshold: s.min_temp,
          createdAt: new Date(ts),
          updatedAt: new Date(ts),
        });
      }

      processed++;
      const pct = (processed / total) * 100;
      if (verbose) {
        if (processed % 2000 === 0 || processed === total) {
          const el = (Date.now() - t0) / 1000;
          const rate = Math.round(processed / Math.max(el, 0.1));
          const eta =
            rate > 0 ? Math.round((total - processed) / rate) : 0;
          console.log(
            `[Seed] ${Math.floor(pct)}% (${processed.toLocaleString()}/${total.toLocaleString()}) | ${s.id} | ${rate.toLocaleString()} rows/s | ETA ${eta}s`
          );
        }
      } else if (pct >= nextMilestone || processed === total) {
        const el = (Date.now() - t0) / 1000;
        const rate = Math.round(processed / Math.max(el, 0.1));
        console.log(
          `[Seed] ${Math.floor(pct)}% (${processed.toLocaleString()}/${total.toLocaleString()}) | ${rate.toLocaleString()} rows/s`
        );
        nextMilestone += 25;
      }
    }
    console.log(`[Seed] Sensor ${si + 1}/5 done (${s.id})`);
  }

  console.log(
    `[Seed] Inserting ${readingsBatch.length.toLocaleString()} readings...`
  );
  const CHUNK = 2000;
  for (let i = 0; i < readingsBatch.length; i += CHUNK) {
    await Reading.bulkCreate(readingsBatch.slice(i, i + CHUNK));
    if (verbose) {
      console.log(
        `[Seed] Readings ${Math.min(i + CHUNK, readingsBatch.length).toLocaleString()}/${readingsBatch.length.toLocaleString()}`
      );
    }
  }

  if (alertsBatch.length > 0) {
    console.log(
      `[Seed] Creating ${alertsBatch.length.toLocaleString()} breach alerts...`
    );
    for (let i = 0; i < alertsBatch.length; i += CHUNK) {
      await Alert.bulkCreate(alertsBatch.slice(i, i + CHUNK));
    }
  }

  // Update last_reading_* to latest reading per sensor (mirror server.js)
  for (const s of SENSORS) {
    const latest = await Reading.findOne({
      where: { sensor_id: s.id },
      order: [["createdAt", "DESC"]],
    });
    if (latest) {
      const sensorFields = {
        last_reading_at: latest.createdAt,
        last_reading_value: latest.temperature,
        latitude: latest.latitude,
        longitude: latest.longitude,
      };
      if (latest.gas_detected !== null && latest.gas_detected !== undefined) {
        // Find latest gas-capable reading for gas state
        const latestGas = await Reading.findOne({
          where: { sensor_id: s.id, gas_detected: { [Op.ne]: null } },
          order: [["createdAt", "DESC"]],
        });
        if (latestGas) {
          sensorFields.last_gas_detected = latestGas.gas_detected;
          sensorFields.last_gas_at = latestGas.createdAt;
        }
      }
      await Sensor.update(sensorFields, { where: { id: s.id } });
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[Seed] Done in ${secs}s: ${SENSORS.length} sensors, ${readingsBatch.length.toLocaleString()} readings, ${alertsBatch.length.toLocaleString()} alerts`
  );
  return {
    skipped: false,
    sensors: SENSORS.length,
    readings: readingsBatch.length,
    alerts: alertsBatch.length,
  };
}

// `npm run seed` / `SEED_FORCE=true node -e ...` entrypoint
async function runManual() {
  const sequelize = require("../config/database");
  await sequelize.sync({ force: false, alter: false });
  const admin = await User.findOne({ where: { username: "admin" } });
  await seedTestDataIfEmpty(admin ? admin.id : null, { force: true });
  await sequelize.close();
}

module.exports = { seedTestDataIfEmpty, shouldSeed, runManual, SENSORS };
