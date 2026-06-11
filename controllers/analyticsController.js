const Reading = require("../models/Reading");
const Sensor = require("../models/Sensor");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

exports.getAnalyticsSummary = async (req, res) => {
  try {
    const { sensor_id, startDate, endDate } = req.query;

    const sensorWhereClause = { user_id: req.user.id };
    if (sensor_id) {
      sensorWhereClause.id = sensor_id;
    }

    const readingWhereClause = {};
    if (startDate && endDate) {
      readingWhereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const stats = await Reading.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
        [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
        [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
        [sequelize.fn("COUNT", sequelize.col("Reading.id")), "totalReadings"],
        [sequelize.fn("STDDEV", sequelize.col("temperature")), "stdDev"],
      ],
      include: [
        {
          model: Sensor,
          where: sensorWhereClause,
          attributes: [],
        },
      ],
      where: readingWhereClause,
      raw: true,
    });

    // Get alerts count
    const alertsCount = await Reading.count({
      include: [
        {
          model: Sensor,
          where: sensorWhereClause,
        },
      ],
      where: {
        temperature: {
          [Op.gt]: sequelize.col("Sensor.max_temp"),
        },
        ...readingWhereClause,
      },
    });

    res.json({
      success: true,
      summary: {
        avgTemp: stats.avgTemp ? parseFloat(stats.avgTemp).toFixed(2) : null,
        minTemp: stats.minTemp ? parseFloat(stats.minTemp).toFixed(2) : null,
        maxTemp: stats.maxTemp ? parseFloat(stats.maxTemp).toFixed(2) : null,
        totalReadings: stats.totalReadings || 0,
        stdDev: stats.stdDev ? parseFloat(stats.stdDev).toFixed(2) : null,
        alertsCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getHourlyAnalytics = async (req, res) => {
  try {
    const { sensor_id, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const sensorWhereClause = { user_id: req.user.id };
    if (sensor_id && sensor_id !== "ALL") {
      sensorWhereClause.id = sensor_id;
    }

    // FIX: Specify table name for createdAt to avoid ambiguity
    const hourlyData = await Reading.findAll({
      attributes: [
        [sequelize.fn("HOUR", sequelize.col("Reading.createdAt")), "hour"],
        [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
        [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
        [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
        [sequelize.fn("COUNT", sequelize.col("Reading.id")), "readingsCount"],
      ],
      include: [{
        model: Sensor,
        where: sensorWhereClause,
        attributes: [],
        required: true
      }],
      where: {
        createdAt: {
          [Op.between]: [targetDate, nextDay]
        }
      },
      group: [sequelize.fn("HOUR", sequelize.col("Reading.createdAt"))],
      order: [[sequelize.fn("HOUR", sequelize.col("Reading.createdAt")), "ASC"]],
      raw: true,
    });

    res.json({ success: true, hourlyData });
  } catch (error) {
    console.error("Hourly analytics error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getSensorComparison = async (req, res) => {
  try {
    const sensors = await Sensor.findAll({
      where: { user_id: req.user.id, status: "active" },
      attributes: ["id", "name"],
    });

    const sensorStats = await Promise.all(
      sensors.map(async (sensor) => {
        // FIX: Specify table name for columns
        const stats = await Reading.findOne({
          attributes: [
            [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
            [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
            [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
            [sequelize.fn("COUNT", sequelize.col("Reading.id")), "readingsCount"],
          ],
          where: { sensor_id: sensor.id },
          raw: true,
        });

        // Get latest reading
        const latestReading = await Reading.findOne({
          where: { sensor_id: sensor.id },
          order: [["createdAt", "DESC"]],
          attributes: ["temperature", "createdAt"]
        });

        return {
          id: sensor.id,
          name: sensor.name,
          stats: {
            avgTemp: stats.avgTemp ? parseFloat(stats.avgTemp).toFixed(1) : null,
            maxTemp: stats.maxTemp ? parseFloat(stats.maxTemp).toFixed(1) : null,
            minTemp: stats.minTemp ? parseFloat(stats.minTemp).toFixed(1) : null,
            totalReadings: stats.readingsCount || 0,
            latestReading: latestReading ? latestReading.temperature : null,
            latestReadingTime: latestReading ? latestReading.createdAt : null,
          }
        };
      })
    );

    res.json({ success: true, comparison: sensorStats });
  } catch (error) {
    console.error("Sensor comparison error:", error);
    res.status(500).json({ error: error.message });
  }
};
