const Alert = require("../models/Alert");
const Sensor = require("../models/Sensor");
const { Op } = require("sequelize");

exports.getAlerts = async (req, res) => {
  try {
    const { type, acknowledged, sensor_id, limit = 50, offset = 0 } = req.query;
    const whereClause = {};
    if (type) whereClause.type = type;
    if (acknowledged === "true") whereClause.acknowledged = true;
    else if (acknowledged === "false") whereClause.acknowledged = false;
    if (sensor_id) whereClause.sensor_id = sensor_id;

    const alerts = await Alert.findAll({
      where: whereClause,
      include: [{ model: Sensor, attributes: ["id", "name", "location_name"] }],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const total = await Alert.count({ where: whereClause });

    res.json({ success: true, alerts, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAlertStats = async (req, res) => {
  try {
    const total = await Alert.count();
    const highTemp = await Alert.count({ where: { type: "HIGH_TEMP" } });
    const lowTemp = await Alert.count({ where: { type: "LOW_TEMP" } });
    const unacknowledged = await Alert.count({ where: { acknowledged: false } });

    res.json({ success: true, stats: { total, highTemp, lowTemp, unacknowledged } });
  } catch (error) {
    console.error("Alert stats error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    await alert.update({
      acknowledged: true,
      acknowledged_at: new Date(),
      acknowledged_by: req.user.id,
    });

    res.json({ success: true, alert });
  } catch (error) {
    console.error("Acknowledge alert error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ error: "Alert not found" });

    await alert.destroy();
    res.json({ success: true, message: "Alert deleted" });
  } catch (error) {
    console.error("Delete alert error:", error);
    res.status(500).json({ error: error.message });
  }
};
