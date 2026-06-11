const Sensor = require("../models/Sensor");
const Reading = require("../models/Reading");
const MaintenanceTask = require("../models/maintenance");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get sensor counts
    const totalSensors = await Sensor.count({ where: { user_id: userId } });
    const activeSensors = await Sensor.count({
      where: { user_id: userId, status: "active" },
    });
    const sensorsInMaintenance = await Sensor.count({
      where: { user_id: userId, status: "maintenance" },
    });

    // Get maintenance summary
    const today = new Date().toISOString().split("T")[0];
    const overdueTasks = await MaintenanceTask.count({
      include: [{ model: Sensor, where: { user_id: userId } }],
      where: { status: "Overdue" },
    });
    const dueSoonTasks = await MaintenanceTask.count({
      include: [{ model: Sensor, where: { user_id: userId } }],
      where: { status: "Due Soon" },
    });

    // Get total readings
    const totalReadings = await Reading.count({
      include: [{ model: Sensor, where: { user_id: userId } }],
    });

    // Get recent alerts (temperature above max_temp)
    const alerts = await Reading.findAll({
      include: [
        {
          model: Sensor,
          where: { user_id: userId },
          required: true,
        },
      ],
      where: {
        temperature: {
          [Op.gt]: sequelize.col("Sensor.max_temp"),
        },
      },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    // Get overall temperature stats
    const tempStats = await Reading.findOne({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
        [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
        [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
      ],
      include: [
        {
          model: Sensor,
          where: { user_id: userId },
          attributes: [],
        },
      ],
      raw: true,
    });

    res.json({
      success: true,
      stats: {
        totalSensors,
        activeSensors,
        sensorsInMaintenance,
        overdueTasks,
        dueSoonTasks,
        totalReadings,
        averageTemperature: tempStats.avgTemp
          ? parseFloat(tempStats.avgTemp).toFixed(1)
          : null,
        minTemperature: tempStats.minTemp
          ? parseFloat(tempStats.minTemp).toFixed(1)
          : null,
        maxTemperature: tempStats.maxTemp
          ? parseFloat(tempStats.maxTemp).toFixed(1)
          : null,
      },
      recentAlerts: alerts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTemperatureTrends = async (req, res) => {
  try {
    const { period = "week", sensor_id } = req.query;
    const userId = req.user.id;

    let dateFormat;
    let groupFormat;
    const now = new Date();
    let startDate;
    const sequelize = require("../config/database");

    switch (period) {
      case "day":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        // SQLite uses strftime for date formatting
        dateFormat = "%Y-%m-%d %H:00:00";
        groupFormat = "%Y-%m-%d %H";
        break;
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        dateFormat = "%Y-%m-%d";
        groupFormat = "%Y-%m-%d";
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        dateFormat = "%Y-%m-%d";
        groupFormat = "%Y-%m-%d";
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
        dateFormat = "%Y-%m-%d";
        groupFormat = "%Y-%m-%d";
    }

    const whereClause = {
      createdAt: { [Op.gte]: startDate }
    };

    if (sensor_id && sensor_id !== "ALL") {
      whereClause.sensor_id = sensor_id;
    }

    // SQLite uses strftime instead of DATE_FORMAT
    const trends = await Reading.findAll({
      attributes: [
        [
          sequelize.fn("strftime", dateFormat, sequelize.col("Reading.createdAt")),
          "timePeriod"
        ],
        [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
        [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
        [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
        [sequelize.fn("COUNT", sequelize.col("Reading.id")), "readingsCount"],
      ],
      include: [
        {
          model: Sensor,
          where: { user_id: userId },
          attributes: [],
          required: true
        },
      ],
      where: whereClause,
      group: [
        sequelize.fn("strftime", groupFormat, sequelize.col("Reading.createdAt"))
      ],
      order: [
        [
          sequelize.fn("strftime", groupFormat, sequelize.col("Reading.createdAt")),
          "ASC"
        ]
      ],
      raw: true,
    });

    res.json({ success: true, trends, period });
  } catch (error) {
    console.error("Trends error:", error);
    res.status(500).json({ error: error.message });
  }
};
