const Report = require("../models/Report");
const Reading = require("../models/Reading");
const Sensor = require("../models/Sensor");
const MaintenanceTask = require("../models/maintenance");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  generatePDFReport,
  generateCSVReport,
} = require("../utils/reportGenerator");
const fs = require("fs");
const path = require("path");

exports.generateReport = async (req, res) => {
  let report = null;

  try {
    const {
      title,
      type,
      startDate,
      endDate,
      includeReadings = true,
      includeMaintenance = true,
      format = "json",
    } = req.body;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date required" });
    }

    // Create report record with user_id and file_url
    report = await Report.create({
      title: title || `Report ${new Date().toISOString()}`,
      type: type || "custom",
      date_range_start: new Date(startDate),
      date_range_end: new Date(endDate),
      status: "generating",
      format: format,
      user_id: req.user.id,
      file_url: null,
    });

    // Gather data asynchronously
    const reportData = {};

    // Fetch readings if included
    if (includeReadings) {
      const readings = await Reading.findAll({
        include: [
          {
            model: Sensor,
            where: { user_id: req.user.id },
            attributes: ["name", "location_name"],
            required: true,
          },
        ],
        where: {
          createdAt: {
            [Op.between]: [new Date(startDate), new Date(endDate)],
          },
        },
        order: [["createdAt", "ASC"]],
      });

      const tempStats = await Reading.findOne({
        attributes: [
          [sequelize.fn("AVG", sequelize.col("temperature")), "avgTemp"],
          [sequelize.fn("MIN", sequelize.col("temperature")), "minTemp"],
          [sequelize.fn("MAX", sequelize.col("temperature")), "maxTemp"],
        ],
        include: [
          {
            model: Sensor,
            where: { user_id: req.user.id },
            attributes: [],
            required: true,
          },
        ],
        where: {
          createdAt: {
            [Op.between]: [new Date(startDate), new Date(endDate)],
          },
        },
        raw: true,
      });

      reportData.readings = {
        total: readings.length,
        averageTemp: tempStats?.avgTemp
          ? parseFloat(tempStats.avgTemp).toFixed(2)
          : null,
        minTemp: tempStats?.minTemp
          ? parseFloat(tempStats.minTemp).toFixed(2)
          : null,
        maxTemp: tempStats?.maxTemp
          ? parseFloat(tempStats.maxTemp).toFixed(2)
          : null,
        data: readings,
      };
    }

    // Fetch maintenance tasks if included
    if (includeMaintenance) {
      const maintenance = await MaintenanceTask.findAll({
        include: [
          {
            model: Sensor,
            where: { user_id: req.user.id },
            attributes: ["name"],
            required: true,
          },
        ],
        where: {
          createdAt: {
            [Op.between]: [new Date(startDate), new Date(endDate)],
          },
        },
      });

      reportData.maintenance = {
        total: maintenance.length,
        completed: maintenance.filter((m) => m.status === "Completed").length,
        overdue: maintenance.filter((m) => m.status === "Overdue").length,
        byType: maintenance.reduce((acc, m) => {
          acc[m.type] = (acc[m.type] || 0) + 1;
          return acc;
        }, {}),
        data: maintenance,
      };
    }

    // Get sensor summary
    const sensors = await Sensor.findAll({
      where: { user_id: req.user.id },
      attributes: [
        "id",
        "name",
        "status",
        "location_name",
        "min_temp",
        "max_temp",
      ],
    });

    reportData.sensors = {
      total: sensors.length,
      active: sensors.filter((s) => s.status === "active").length,
      inactive: sensors.filter((s) => s.status === "inactive").length,
      maintenance: sensors.filter((s) => s.status === "maintenance").length,
      data: sensors,
    };

    // Generate file URL if format is PDF or CSV
    let fileUrl = null;
    if (format === "pdf") {
      fileUrl = await generatePDFReport(report, reportData);
    } else if (format === "csv") {
      fileUrl = await generateCSVReport(report, reportData);
    }

    // Update report with data and file URL
    await report.update({
      status: "completed",
      data_summary: reportData,
      file_url: fileUrl,
    });

    res.status(201).json({
      success: true,
      message: "Report generated successfully",
      report: {
        id: report.id,
        title: report.title,
        type: report.type,
        format: report.format,
        createdAt: report.createdAt,
        date_range: {
          start: report.date_range_start,
          end: report.date_range_end,
        },
        file_url: fileUrl,
        data_summary: reportData,
      },
    });
  } catch (error) {
    console.error("Generate report error:", error);

    // Update report status to failed if it was created
    if (report && report.id) {
      await report.update({ status: "failed" });
    }

    res
      .status(500)
      .json({ error: "Failed to generate report: " + error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const reports = await Report.findAll({
      where: { user_id: req.user.id },
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "title",
        "type",
        "format",
        "date_range_start",
        "date_range_end",
        "status",
        "file_url",
        "createdAt",
      ],
    });

    res.json({
      success: true,
      reports,
      count: reports.length,
    });
  } catch (error) {
    console.error("Get reports error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ success: true, report });
  } catch (error) {
    console.error("Get report by ID error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.downloadReportFile = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    if (!report.file_url) {
      return res.status(404).json({ error: "No file associated with this report" });
    }

    // Construct the absolute file path
    const filePath = path.join(__dirname, '..', report.file_url);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Report file not found on server" });
    }

    // Set appropriate headers based on file format
    let contentType = 'application/json';
    let fileExtension = 'json';
    
    if (report.format === 'pdf') {
      contentType = 'application/pdf';
      fileExtension = 'pdf';
    } else if (report.format === 'csv') {
      contentType = 'text/csv';
      fileExtension = 'csv';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.title}.${fileExtension}"`);
    
    // Send the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error("Download report error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Delete the file from storage
    if (report.file_url) {
      const filePath = path.join(__dirname, "..", report.file_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await report.destroy();
    res.json({ success: true, message: "Report deleted successfully" });
  } catch (error) {
    console.error("Delete report error:", error);
    res.status(500).json({ error: error.message });
  }
};
