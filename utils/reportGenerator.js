const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

// Ensure reports directory exists
const REPORTS_DIR = path.join(__dirname, "../reports");
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Professional color scheme
const COLORS = {
  primary: "#0D3B66",
  secondary: "#2A9D8F",
  accent: "#E76F51",
  warning: "#F4A261",
  text: "#2C3E50",
  textLight: "#7F8C8D",
  border: "#ECF0F1",
  background: "#F8F9FA",
  success: "#27AE60",
  danger: "#E74C3C",
};

// Helper function to add header
function addHeader(doc, title) {
  // Add logo/header bar
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary);

  doc
    .fillColor("#FFFFFF")
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(title, 50, 25, { align: "center" });

  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Temperature Monitoring System Report", 50, 55, { align: "center" });

  doc.fillColor(COLORS.text);
}

// Helper function to add footer
function addFooter(doc, pageNumber) {
  doc.save();

  doc.fontSize(8);
  doc.fillColor("#888");

  const text = `Generated on ${new Date().toLocaleString()} | Page ${pageNumber}`;

  const textWidth = doc.widthOfString(text);

  doc.text(
    text,
    (doc.page.width - textWidth) / 2,
    doc.page.height - 35,
    {
      lineBreak: false,
    }
  );

  doc.restore();
}

// Helper function to add metric card
function addMetricCard(doc, x, y, width, title, value, color, icon) {
  // Card background
  doc.rect(x, y, width, 80).fill("#FFFFFF").stroke(color);

  // Icon circle
  doc.circle(x + 25, y + 40, 15).fill(color);

  doc
    .fillColor("#FFFFFF")
    .fontSize(12)
    .text(icon, x + 20, y + 34, { align: "center" });

  // Title and value
  doc
    .fillColor(COLORS.text)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(title, x + 50, y + 25);

  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .fillColor(color)
    .text(value.toString(), x + 50, y + 45);
}

// Helper function to add status badge
function addStatusBadge(doc, x, y, text, color) {
  const width = 60;
  const height = 20;

  doc.roundedRect(x, y, width, height, 5).fill(color);

  doc
    .fillColor("#FFFFFF")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(text, x + width / 2, y + 5, { align: "center" });
}

// Helper function to add section title
function addSectionTitle(doc, title, icon = "") {
  doc
    .fillColor(COLORS.primary)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(
      icon ? `${icon} ${title}` : title,
      50,
      doc.y
    );

  doc.moveDown(0.5);

  doc
    .strokeColor(COLORS.secondary)
    .lineWidth(2)
    .moveTo(50, doc.y - 5)
    .lineTo(200, doc.y - 5)
    .stroke();

  doc.moveDown();
}

// Helper function to add table header
function addTableHeader(doc, headers, startX, startY, columnWidths) {
  doc.fillColor(COLORS.primary).fontSize(10).font("Helvetica-Bold");

  let currentX = startX;
  headers.forEach((header, index) => {
    doc.text(header, currentX, startY);
    currentX += columnWidths[index];
  });

  // Draw header underline
  doc
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .moveTo(startX, startY + 15)
    .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY + 15)
    .stroke();

  return startY + 20;
}

// Helper function to add table row
function addTableRow(
  doc,
  cells,
  startX,
  startY,
  columnWidths,
  alternate = false,
) {
  if (alternate) {
    doc
      .rect(
        startX,
        startY - 12,
        columnWidths.reduce((a, b) => a + b, 0),
        20,
      )
      .fill("#F8F9FA");
  }

  doc.fillColor(COLORS.text).fontSize(9).font("Helvetica");

  let currentX = startX;
  cells.forEach((cell, index) => {
    doc.text(cell.toString(), currentX, startY);
    currentX += columnWidths[index];
  });

  return startY + 20;
}

async function generatePDFReport(report, reportData) {
  const fileName = `report_${report.id}_${Date.now()}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        layout: "portrait",
      });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      let pageNumber = 1;

      // ── FIX 3: strip emoji so Helvetica never sees a glyph it can't render ──
      const safe = (str) =>
        String(str ?? "").replace(
          /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/gu,
          "",
        );

      // Wrap helpers so every string they receive is emoji-free
      const safeAddHeader = (doc, title) => addHeader(doc, safe(title));
      const safeAddSectionTitle = (doc, title, _icon) =>
        addSectionTitle(doc, safe(title));

      // ==================== COVER PAGE ====================
      safeAddHeader(doc, report.title);

      const centerY = (doc.page.height - 200) / 2;

      doc
        .fillColor(COLORS.secondary)
        .fontSize(48)
        .font("Helvetica-Bold")
        .text("TEMPERATURE", 50, centerY - 40, { align: "center" })
        .text("MONITORING REPORT", 50, centerY + 10, { align: "center" });

      doc
        .fillColor(COLORS.textLight)
        .fontSize(12)
        .font("Helvetica")
        .text(report.title, 50, centerY + 80, { align: "center" });

      const metaY = centerY + 140;
      doc.roundedRect(50, metaY, doc.page.width - 100, 100, 10).fill("#F8F9FA");

      doc.fillColor(COLORS.text).fontSize(10);
      let metaStartY = metaY + 20;
      doc.text(`Report ID: ${report.id}`, 70, metaStartY);
      doc.text(
        `Report Type: ${report.type.toUpperCase()}`,
        70,
        metaStartY + 20,
      );
      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        70,
        metaStartY + 40,
      );
      doc.text(
        `Period: ${new Date(report.date_range_start).toLocaleDateString()} - ${new Date(report.date_range_end).toLocaleDateString()}`,
        70,
        metaStartY + 60,
      );

      addFooter(doc, pageNumber++);
      doc.addPage();

      // ==================== EXECUTIVE SUMMARY PAGE ====================
      safeAddHeader(doc, "Executive Summary");
      safeAddSectionTitle(doc, "Key Performance Indicators");

      const cardWidth = (doc.page.width - 120) / 3;
      const kpiY = doc.y; // ── FIX 2: capture y once so all three cards share the same row
      addMetricCard(
        doc,
        50,
        kpiY,
        cardWidth,
        "Total Sensors",
        reportData.sensors?.total || 0,
        COLORS.primary,
        "",
      );
      addMetricCard(
        doc,
        70 + cardWidth,
        kpiY,
        cardWidth,
        "Total Readings",
        reportData.readings?.total || 0,
        COLORS.secondary,
        "",
      );
      addMetricCard(
        doc,
        90 + cardWidth * 2,
        kpiY,
        cardWidth,
        "Active Alerts",
        reportData.readings?.alertsCount || 0,
        COLORS.accent,
        "",
      );

      doc.moveDown(4);

      safeAddSectionTitle(doc, "System Status");

      const statusY = doc.y;
      const statusItems = [
        {
          label: "Active Sensors",
          value: reportData.sensors?.active || 0,
          color: COLORS.success,
        },
        {
          label: "In Maintenance",
          value: reportData.sensors?.maintenance || 0,
          color: COLORS.warning,
        },
        {
          label: "Overdue Tasks",
          value: reportData.maintenance?.overdue || 0,
          color: COLORS.danger,
        },
        {
          label: "Completed Tasks",
          value: reportData.maintenance?.completed || 0,
          color: COLORS.success,
        },
      ];

      statusItems.forEach((item, index) => {
        const x = 50 + (index % 2) * 250;
        const y = statusY + Math.floor(index / 2) * 40;
        doc.fillColor(COLORS.text).fontSize(11).text(`${item.label}:`, x, y);
        addStatusBadge(doc, x + 120, y - 2, item.value.toString(), item.color);
      });

      addFooter(doc, pageNumber++);
      doc.addPage();

      // ==================== SENSORS OVERVIEW PAGE ====================
      safeAddHeader(doc, "Sensors Overview");
      safeAddSectionTitle(doc, "Sensor Distribution");

      const sensorHeaders = [
        "Sensor ID",
        "Name",
        "Status",
        "Location",
        "Last Reading",
      ];
      const sensorWidths = [70, 100, 60, 100, 70];
      let currentY = doc.y;

      currentY = addTableHeader(doc, sensorHeaders, 50, currentY, sensorWidths);

      (reportData.sensors?.data || []).slice(0, 20).forEach((sensor, index) => {
        if (currentY > 700) {
          addFooter(doc, pageNumber++);
          doc.addPage();
          safeAddHeader(doc, "Sensors Overview (Continued)");
          currentY = doc.y + 30;
          currentY = addTableHeader(
            doc,
            sensorHeaders,
            50,
            currentY,
            sensorWidths,
          );
        }

        const status =
          sensor.status.charAt(0).toUpperCase() + sensor.status.slice(1);

        currentY = addTableRow(
          doc,
          [
            sensor.id,
            sensor.name,
            status,
            sensor.location_name || "N/A",
            sensor.last_reading_value ? `${sensor.last_reading_value}C` : "N/A",
          ],
          50,
          currentY,
          sensorWidths,
          index % 2 === 1,
        );
      });

      addFooter(doc, pageNumber++);
      doc.addPage();

      // ==================== TEMPERATURE READINGS PAGE ====================
      if (reportData.readings && reportData.readings.data) {
        safeAddHeader(doc, "Temperature Analysis");
        safeAddSectionTitle(doc, "Temperature Statistics");

        const statsY = doc.y;
        const statBoxWidth = (doc.page.width - 120) / 4;

        const tempStats = [
          {
            label: "Average",
            value: `${reportData.readings.averageTemp || 0}C`,
            color: COLORS.secondary,
          },
          {
            label: "Minimum",
            value: `${reportData.readings.minTemp || 0}C`,
            color: COLORS.primary,
          },
          {
            label: "Maximum",
            value: `${reportData.readings.maxTemp || 0}C`,
            color: COLORS.accent,
          },
          {
            label: "Total",
            value: reportData.readings.total || 0,
            color: COLORS.warning,
          },
        ];

        // ── FIX 2: draw each stat box at a fixed y (statsY) not at the moving doc.y
        tempStats.forEach((stat, index) => {
          const x = 50 + index * statBoxWidth;
          doc.roundedRect(x, statsY, statBoxWidth - 10, 60, 5).fill("#F8F9FA");
          doc
            .fillColor(COLORS.textLight)
            .fontSize(9)
            .text(stat.label, x + 15, statsY + 15);
          doc
            .fillColor(stat.color)
            .fontSize(18)
            .font("Helvetica-Bold")
            .text(String(stat.value), x + 15, statsY + 35);
        });

        doc.font("Helvetica").moveDown(5);

        safeAddSectionTitle(doc, "Detailed Readings");

        const readingHeaders = [
          "Date/Time",
          "Sensor",
          "Temperature",
          "Location",
        ];
        const readingWidths = [120, 100, 70, 100];
        currentY = doc.y;

        currentY = addTableHeader(
          doc,
          readingHeaders,
          50,
          currentY,
          readingWidths,
        );

        let rowCount = 0;
        for (const reading of reportData.readings.data.slice(0, 100)) {
          if (currentY > 700) {
            addFooter(doc, pageNumber++);
            doc.addPage();
            safeAddHeader(doc, "Temperature Analysis (Continued)");
            currentY = doc.y + 30;
            currentY = addTableHeader(
              doc,
              readingHeaders,
              50,
              currentY,
              readingWidths,
            );
          }

          const date = new Date(reading.createdAt).toLocaleString();

          currentY = addTableRow(
            doc,
            [
              date,
              reading.Sensor?.name || "Unknown",
              `${reading.temperature.toFixed(1)}C`,
              reading.Sensor?.location_name || "N/A",
            ],
            50,
            currentY,
            readingWidths,
            rowCount % 2 === 1,
          );
          rowCount++;
        }

        if (reportData.readings.data.length > 100) {
          doc
            .fillColor(COLORS.textLight)
            .fontSize(9)
            .text(
              `* Showing first 100 of ${reportData.readings.data.length} readings`,
              50,
              doc.y,
            );
        }

        addFooter(doc, pageNumber++);
        // ── FIX 1: only add a new page when there IS a maintenance section to follow
        if (reportData.maintenance) doc.addPage();
      }

      // ==================== MAINTENANCE OVERVIEW PAGE ====================
      if (reportData.maintenance) {
        safeAddHeader(doc, "Maintenance Overview");
        safeAddSectionTitle(doc, "Maintenance Summary");

        const mainStats = [
          {
            label: "Total Tasks",
            value: reportData.maintenance.total || 0,
            color: COLORS.primary,
          },
          {
            label: "Completed",
            value: reportData.maintenance.completed || 0,
            color: COLORS.success,
          },
          {
            label: "Overdue",
            value: reportData.maintenance.overdue || 0,
            color: COLORS.danger,
          },
          {
            label: "Due Soon",
            value: reportData.maintenance.dueSoon || 0,
            color: COLORS.warning,
          },
        ];

        // ── FIX 2: capture y before the loop so every card starts at the same row
        const mainStatsY = doc.y;
        const mainStatWidth = (doc.page.width - 120) / 4;

        mainStats.forEach((stat, index) => {
          const x = 50 + index * mainStatWidth;
          doc
            .roundedRect(x, mainStatsY, mainStatWidth - 10, 60, 5)
            .fill("#F8F9FA");
          doc
            .fillColor(COLORS.textLight)
            .fontSize(9)
            .text(stat.label, x + 15, mainStatsY + 15);
          doc
            .fillColor(stat.color)
            .fontSize(18)
            .font("Helvetica-Bold")
            .text(stat.value.toString(), x + 15, mainStatsY + 35);
        });

        doc.font("Helvetica").moveDown(5);

        if (
          reportData.maintenance.byType &&
          Object.keys(reportData.maintenance.byType).length > 0
        ) {
          safeAddSectionTitle(doc, "Tasks by Type");

          const typeHeaders = ["Task Type", "Count"];
          const typeWidths = [200, 100];
          currentY = doc.y;

          currentY = addTableHeader(doc, typeHeaders, 50, currentY, typeWidths);

          let typeIndex = 0;
          for (const [type, count] of Object.entries(
            reportData.maintenance.byType,
          )) {
            if (currentY > 700) {
              addFooter(doc, pageNumber++);
              doc.addPage();
              safeAddHeader(doc, "Maintenance Overview (Continued)");
              currentY = doc.y + 30;
              currentY = addTableHeader(
                doc,
                typeHeaders,
                50,
                currentY,
                typeWidths,
              );
            }
            currentY = addTableRow(
              doc,
              [type, count],
              50,
              currentY,
              typeWidths,
              typeIndex % 2 === 1,
            );
            typeIndex++;
          }
        }

        addFooter(doc, pageNumber++);

        // ── FIX 1: only add a page when detailed tasks actually exist
        if (
          reportData.maintenance.data &&
          reportData.maintenance.data.length > 0
        ) {
          doc.addPage();
          safeAddHeader(doc, "Maintenance Tasks Details");
          safeAddSectionTitle(doc, "Upcoming & Overdue Tasks");

          const taskHeaders = [
            "Title",
            "Type",
            "Due Date",
            "Status",
            "Priority",
          ];
          const taskWidths = [100, 80, 80, 60, 60];
          currentY = doc.y;

          currentY = addTableHeader(doc, taskHeaders, 50, currentY, taskWidths);

          let taskCount = 0;
          for (const task of reportData.maintenance.data.slice(0, 50)) {
            if (currentY > 700) {
              addFooter(doc, pageNumber++);
              doc.addPage();
              safeAddHeader(doc, "Maintenance Tasks Details (Continued)");
              currentY = doc.y + 30;
              currentY = addTableHeader(
                doc,
                taskHeaders,
                50,
                currentY,
                taskWidths,
              );
            }

            currentY = addTableRow(
              doc,
              [
                task.title,
                task.type,
                new Date(task.dueDate).toLocaleDateString(),
                task.status,
                task.priority || "Medium",
              ],
              50,
              currentY,
              taskWidths,
              taskCount % 2 === 1,
            );
            taskCount++;
          }

          addFooter(doc, pageNumber++);
        }
      }

      // ==================== FINAL PAGE ====================
      // ── FIX 1: always add this page explicitly; the previous section's
      //    addPage() is gone — we add it here unconditionally.
      doc.addPage();
      safeAddHeader(doc, "Report Summary");
      safeAddSectionTitle(doc, "Conclusion & Recommendations");

      doc
        .fillColor(COLORS.text)
        .fontSize(11)
        .text(
          "Based on the data collected during the report period, the following observations and recommendations are made:",
          50,
          doc.y,
          { width: doc.page.width - 100 },
        );
      doc.moveDown();

      const recommendations = [
        "Regular monitoring of sensor calibration is recommended",
        "Schedule preventive maintenance for sensors showing irregular patterns",
        "Review temperature thresholds for sensors with frequent alerts",
        "Consider adding additional sensors in critical monitoring areas",
      ];

      recommendations.forEach((rec) => {
        doc.fillColor(COLORS.text).fontSize(10).text(`- ${rec}`, 50, doc.y);
        doc.moveDown(0.5);
      });

      doc.moveDown(2);

      doc
        .fillColor(COLORS.textLight)
        .fontSize(8)
        .text(
          "This report was automatically generated by the Temperature Monitoring System.",
          50,
          doc.page.height - 80,
          { align: "center" },
        );
      doc.text(
        "For questions or support, please contact your system administrator.",
        50,
        doc.page.height - 70,
        { align: "center" },
      );

      addFooter(doc, pageNumber++);

      doc.end();

      stream.on("finish", () => resolve(`/reports/${fileName}`));
      stream.on("error", reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function generateCSVReport(report, reportData) {
  const fileName = `report_${report.id}_${Date.now()}.csv`;
  const filePath = path.join(REPORTS_DIR, fileName);

  try {
    const workbook = new ExcelJS.Workbook();

    // Style the workbook
    workbook.creator = "Temperature Monitoring System";
    workbook.lastModifiedBy = "System";
    workbook.created = new Date();
    workbook.modified = new Date();

    // ==================== SUMMARY SHEET ====================
    const summarySheet = workbook.addWorksheet("Summary", {
      pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    // Style headers
    const headerStyle = {
      font: { bold: true, size: 12, color: { argb: "FFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "0D3B66" } },
      alignment: { horizontal: "center", vertical: "middle" },
    };

    const titleStyle = {
      font: { bold: true, size: 14, color: { argb: "0D3B66" } },
      alignment: { horizontal: "center" },
    };

    // Report metadata
    summarySheet.mergeCells("A1:C1");
    summarySheet.getCell("A1").value = report.title;
    summarySheet.getCell("A1").style = titleStyle;

    summarySheet.getCell("A3").value = "Report Metadata";
    summarySheet.getCell("A3").style = headerStyle;

    summarySheet.addRow(["Generated", new Date().toLocaleString()]);
    summarySheet.addRow(["Report Type", report.type.toUpperCase()]);
    summarySheet.addRow([
      "Period Start",
      new Date(report.date_range_start).toLocaleDateString(),
    ]);
    summarySheet.addRow([
      "Period End",
      new Date(report.date_range_end).toLocaleDateString(),
    ]);
    summarySheet.addRow([]);

    // KPIs
    summarySheet.getCell(`A${summarySheet.rowCount + 1}`).value =
      "Key Performance Indicators";
    summarySheet.getCell(`A${summarySheet.rowCount}`).style = headerStyle;

    summarySheet.addRow(["Total Sensors", reportData.sensors?.total || 0]);
    summarySheet.addRow(["Active Sensors", reportData.sensors?.active || 0]);
    summarySheet.addRow([
      "Sensors in Maintenance",
      reportData.sensors?.maintenance || 0,
    ]);
    summarySheet.addRow(["Total Readings", reportData.readings?.total || 0]);
    summarySheet.addRow([
      "Average Temperature",
      `${reportData.readings?.averageTemp || 0}°C`,
    ]);
    summarySheet.addRow([
      "Max Temperature",
      `${reportData.readings?.maxTemp || 0}°C`,
    ]);
    summarySheet.addRow([
      "Min Temperature",
      `${reportData.readings?.minTemp || 0}°C`,
    ]);
    summarySheet.addRow([
      "Total Maintenance Tasks",
      reportData.maintenance?.total || 0,
    ]);
    summarySheet.addRow([
      "Overdue Tasks",
      reportData.maintenance?.overdue || 0,
    ]);
    summarySheet.addRow([
      "Completed Tasks",
      reportData.maintenance?.completed || 0,
    ]);

    // Auto-size columns
    summarySheet.columns.forEach((column) => {
      column.width = 25;
    });

    // ==================== SENSORS SHEET ====================
    const sensorsSheet = workbook.addWorksheet("Sensors");

    sensorsSheet.getCell("A1").value = "Sensor Details";
    sensorsSheet.getCell("A1").style = titleStyle;

    const sensorHeaders = [
      "ID",
      "Name",
      "Status",
      "Location",
      "Min Temp",
      "Max Temp",
      "Last Reading",
      "Last Reading Time",
    ];
    sensorsSheet.addRow(sensorHeaders);
    sensorsSheet.getRow(2).eachCell((cell) => {
      cell.style = headerStyle;
    });

    (reportData.sensors?.data || []).forEach((sensor) => {
      sensorsSheet.addRow([
        sensor.id,
        sensor.name,
        sensor.status,
        sensor.location_name || "N/A",
        sensor.min_temp || 0,
        sensor.max_temp || 0,
        sensor.last_reading_value ? `${sensor.last_reading_value}°C` : "N/A",
        sensor.last_reading_at
          ? new Date(sensor.last_reading_at).toLocaleString()
          : "N/A",
      ]);
    });

    sensorsSheet.columns.forEach((column) => {
      column.width = 18;
    });

    // ==================== READINGS SHEET ====================
    if (reportData.readings?.data && reportData.readings.data.length > 0) {
      const readingsSheet = workbook.addWorksheet("Temperature Readings");

      readingsSheet.getCell("A1").value = "Detailed Temperature Readings";
      readingsSheet.getCell("A1").style = titleStyle;

      const readingHeaders = [
        "Date/Time",
        "Sensor",
        "Temperature (°C)",
        "Location",
        "Status",
      ];
      readingsSheet.addRow(readingHeaders);
      readingsSheet.getRow(2).eachCell((cell) => {
        cell.style = headerStyle;
      });

      reportData.readings.data.forEach((reading) => {
        const isAbnormal =
          reading.temperature > (reading.Sensor?.max_temp || 38);
        readingsSheet.addRow([
          new Date(reading.createdAt).toLocaleString(),
          reading.Sensor?.name || "Unknown",
          reading.temperature,
          reading.Sensor?.location_name || "N/A",
          isAbnormal ? "⚠️ Alert" : "✓ Normal",
        ]);
      });

      readingsSheet.columns.forEach((column) => {
        column.width = 20;
      });
    }

    // ==================== MAINTENANCE SHEET ====================
    if (
      reportData.maintenance?.data &&
      reportData.maintenance.data.length > 0
    ) {
      const maintenanceSheet = workbook.addWorksheet("Maintenance Tasks");

      maintenanceSheet.getCell("A1").value = "Maintenance Tasks";
      maintenanceSheet.getCell("A1").style = titleStyle;

      const maintenanceHeaders = [
        "Title",
        "Type",
        "Due Date",
        "Status",
        "Priority",
        "Sensor",
        "Created At",
      ];
      maintenanceSheet.addRow(maintenanceHeaders);
      maintenanceSheet.getRow(2).eachCell((cell) => {
        cell.style = headerStyle;
      });

      reportData.maintenance.data.forEach((task) => {
        maintenanceSheet.addRow([
          task.title,
          task.type,
          new Date(task.dueDate).toLocaleDateString(),
          task.status,
          task.priority || "Medium",
          task.Sensor?.name || "Unknown",
          new Date(task.createdAt).toLocaleString(),
        ]);
      });

      maintenanceSheet.columns.forEach((column) => {
        column.width = 18;
      });
    }

    // Write to file
    await workbook.csv.writeFile(filePath);
    return `/reports/${fileName}`;
  } catch (error) {
    console.error("CSV generation error:", error);
    throw error;
  }
}

// Add JSON report generation as fallback
async function generateJSONReport(report, reportData) {
  const fileName = `report_${report.id}_${Date.now()}.json`;
  const filePath = path.join(REPORTS_DIR, fileName);

  const jsonData = {
    metadata: {
      report_id: report.id,
      title: report.title,
      type: report.type,
      generated_at: new Date().toISOString(),
      date_range: {
        start: report.date_range_start,
        end: report.date_range_end,
      },
    },
    data: reportData,
  };

  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
  return `/reports/${fileName}`;
}

module.exports = {
  generatePDFReport,
  generateCSVReport,
  generateJSONReport,
  REPORTS_DIR,
};
