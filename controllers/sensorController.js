const Sensor = require("../models/Sensor");
const Reading = require("../models/Reading");
const { Op, literal } = require("sequelize");
const sequelize = require("../config/database");

exports.getAllSensors = async (req, res) => {
  try {
    const sensors = await Sensor.findAll({
      attributes: [
        "id",
        "name",
        "min_temp",
        "max_temp",
        "status",
        "latitude",
        "longitude",
        "location_name",
        "last_reading_value",
        "last_reading_at",
        "has_gas_sensor",
        "last_gas_detected",
        "last_gas_at",
      ],
    });
    res.json({ success: true, sensors });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user sensors." });
  }
};

exports.getSensorById = async (req, res) => {
  try {
    const sensor = await Sensor.findByPk(req.params.id);
    if (!sensor) {
      return res
        .status(404)
        .json({ success: false, message: "Sensor not found" });
    }
    res.json({ success: true, sensor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createSensor = async (req, res) => {
  try {
    const {
      id,
      name,
      min_temp,
      max_temp,
      status,
      latitude,
      longitude,
      location_name,
      description,
      has_gas_sensor,
      sensor_type,
    } = req.body;
    const userId = req.user.id;

    // Dropdown: "Temperature" | "Temperature + Gas" (also accepts boolean)
    const gasCapable =
      has_gas_sensor === true ||
      has_gas_sensor === 1 ||
      has_gas_sensor === "1" ||
      (typeof sensor_type === "string" &&
        sensor_type.toLowerCase().includes("gas"));

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Sensor id is required" });
    }

    const [sensor, created] = await Sensor.findOrCreate({
      where: { id },
      defaults: {
        name,
        min_temp,
        max_temp,
        status,
        user_id: userId,
        latitude,
        longitude,
        location_name,
        description,
        has_gas_sensor: gasCapable,
      },
    });

    if (!created) {
      return res.status(200).json({
        success: true,
        message: "Sensor already registered",
        data: sensor,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Sensor registered successfully",
      data: sensor,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.updateSensor = async (req, res) => {
  try {
    const sensor = await Sensor.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!sensor) {
      return res
        .status(404)
        .json({ success: false, message: "Sensor not found" });
    }

    // Normalize dropdown value ("Temperature" | "Temperature + Gas")
    const updates = { ...req.body };
    if (updates.sensor_type !== undefined) {
      updates.has_gas_sensor =
        typeof updates.sensor_type === "string" &&
        updates.sensor_type.toLowerCase().includes("gas");
      delete updates.sensor_type;
    }

    await sensor.update(updates);
    res.json({ success: true, message: "Sensor updated successfully", sensor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSensor = async (req, res) => {
  try {
    const sensor = await Sensor.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!sensor) {
      return res
        .status(404)
        .json({ success: false, message: "Sensor not found" });
    }

    await sensor.destroy();
    res.json({ success: true, message: "Sensor deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSensorStats = async (req, res) => {
  try {
    const sensorId = req.params.id;

    const stats = await Reading.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
        [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
        [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
        [sequelize.fn("COUNT", sequelize.col("id")), "totalReadings"],
      ],
      where: { sensor_id: sensorId },
      raw: true,
    });

    const recentReadings = await Reading.findAll({
      where: { sensor_id: sensorId },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    // Gas stats (NULL = temp-only readings, excluded from gas counts)
    const gasStats = await Reading.findOne({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "gasReadings"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              'CASE WHEN "gas_detected" = 1 THEN 1 ELSE 0 END'
            )
          ),
          "gasEvents",
        ],
      ],
      where: { sensor_id: sensorId, gas_detected: { [Op.ne]: null } },
      raw: true,
    });
    const latestGas = await Reading.findOne({
      where: { sensor_id: sensorId, gas_detected: { [Op.ne]: null } },
      order: [["createdAt", "DESC"]],
      attributes: ["gas_detected", "createdAt"],
    });

    res.json({
      success: true,
      stats: {
        avgTemp: stats.avgTemp ? parseFloat(stats.avgTemp).toFixed(1) : null,
        minTemp: stats.minTemp ? parseFloat(stats.minTemp).toFixed(1) : null,
        maxTemp: stats.maxTemp ? parseFloat(stats.maxTemp).toFixed(1) : null,
        totalReadings: stats.totalReadings || 0,
        gasReadings: gasStats ? parseInt(gasStats.gasReadings) || 0 : 0,
        gasEvents: gasStats ? parseInt(gasStats.gasEvents) || 0 : 0,
        latestGas: latestGas
          ? latestGas.gas_detected
            ? 1
            : 0
          : null,
        latestGasTime: latestGas ? latestGas.createdAt : null,
      },
      recentReadings,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSensorsMap = async (req, res) => {
  try {
    const sensors = await Sensor.findAll({
      where: {
        latitude: { [Op.ne]: null },
        longitude: { [Op.ne]: null },
      },
      attributes: [
        "id",
        "name",
        "min_temp",
        "max_temp",
        "latitude",
        "longitude",
        "status",
        "location_name",
        "has_gas_sensor",
        "last_gas_detected",
        "last_gas_at",
      ],
      include: [
        {
          model: Reading,
          attributes: ["temperature", "gas_detected", "createdAt"],
          order: [["createdAt", "DESC"]],
          limit: 1,
          required: false, // LEFT JOIN — include sensors with no readings
        },
      ],
    });

    // Flatten for easier consumption on the frontend
    const result = sensors.map(sensor => ({
      ...sensor.toJSON(),
      last_reading_value: sensor.Readings?.[0]?.temperature ?? null,
      last_gas_detected: sensor.Readings?.[0]?.gas_detected ?? sensor.toJSON().last_gas_detected ?? null,
    }));

    res.json({ success: true, sensors: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
