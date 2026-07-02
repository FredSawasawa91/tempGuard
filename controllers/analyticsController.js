const Reading = require("../models/Reading");
const Sensor = require("../models/Sensor");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

exports.getAnalyticsSummary = async (req, res) => {
  try {
    const { sensor_id, startDate, endDate } = req.query;
    
    const sensorWhereClause = {};
    if (sensor_id && sensor_id !== "ALL") {
      sensorWhereClause.id = sensor_id;
    }

    const readingWhereClause = {};
    if (startDate && endDate) {
      readingWhereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const stats = await Reading.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
        [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
        [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
        [sequelize.fn("COUNT", sequelize.col("Reading.id")), "totalReadings"],
        [sequelize.fn("ROUND", sequelize.fn("AVG", sequelize.col("temperature")), 2), "roundedAvg"],
      ],
      include: [{
        model: Sensor,
        where: sensorWhereClause,
        attributes: [],
        required: true
      }],
      where: readingWhereClause,
      raw: true,
    });

    // Calculate standard deviation manually for SQLite if needed
    let stdDev = null;
    if (stats.totalReadings > 1) {
      const readings = await Reading.findAll({
        attributes: ['temperature'],
        include: [{
          model: Sensor,
          where: sensorWhereClause,
          attributes: [],
          required: true
        }],
        where: readingWhereClause,
        raw: true,
      });
      
      const temps = readings.map(r => r.temperature);
      const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
      const squareDiffs = temps.map(value => Math.pow(value - mean, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / temps.length;
      stdDev = Math.sqrt(avgSquareDiff).toFixed(2);
    }

    // Get alerts count
    const alertsCount = await Reading.count({
      include: [{
        model: Sensor,
        where: sensorWhereClause,
        required: true
      }],
      where: {
        temperature: {
          [Op.gt]: sequelize.col("Sensor.max_temp")
        },
        ...readingWhereClause
      }
    });

    res.json({
      success: true,
      summary: {
        avgTemp: stats.avgTemp ? parseFloat(stats.avgTemp).toFixed(2) : null,
        minTemp: stats.minTemp ? parseFloat(stats.minTemp).toFixed(2) : null,
        maxTemp: stats.maxTemp ? parseFloat(stats.maxTemp).toFixed(2) : null,
        totalReadings: stats.totalReadings || 0,
        stdDev: stdDev,
        alertsCount,
      }
    });
  } catch (error) {
    console.error("Analytics summary error:", error);
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

    const sensorWhereClause = {};
    if (sensor_id && sensor_id !== "ALL") {
      sensorWhereClause.id = sensor_id;
    }

    // SQLite uses strftime for hour extraction
    const hourlyData = await Reading.findAll({
      attributes: [
        [sequelize.fn("strftime", "%H", sequelize.col("Reading.createdAt")), "hour"],
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
      group: [sequelize.fn("strftime", "%H", sequelize.col("Reading.createdAt"))],
      order: [[sequelize.fn("strftime", "%H", sequelize.col("Reading.createdAt")), "ASC"]],
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
      where: { status: "active" },
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
