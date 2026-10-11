const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

// Ensure reports directory exists
const REPORTS_DIR = path.join(__dirname, "../reports");
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Professional color scheme (TempGuard brand + slate neutrals)
const COLORS = {
  primary: "#0D3B66",
  primaryDark: "#082A4A",
  secondary: "#2A9D8F",
  accent: "#E76F51",
  warning: "#F4A261",
  text: "#2C3E50",
  ink: "#1A2B3C",
  textLight: "#7F8C8D",
  border: "#DCE3EA",
  background: "#F4F6F9",
  card: "#FFFFFF",
  success: "#27AE60",
  successBg: "#E8F5E9",
  danger: "#E74C3C",
  dangerBg: "#FDECEA",
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
    .text("TempGuard Monitoring System Report", 50, 55, { align: "center" });

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

// Slim inner-page header: navy bar with section title + brand (replaces
// the oversized full header on content pages; cover keeps addHeader)
function addSlimHeader(doc, title) {
  const w = doc.page.width;
  doc.rect(0, 0, w, 46).fill(COLORS.primary);
  doc
    .fillColor("#FFFFFF")
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(title, 50, 16);
  doc
    .fontSize(9)
    .font("Helvetica")
    .text("TempGuard", 50, 18, { align: "right", width: w - 100 });
  doc.fillColor(COLORS.text);
  doc.y = 64;
}

// Red/green verdict banner (text + color only; Helvetica-safe, no glyphs)
function addVerdictBanner(doc, gasEvents) {
  const alert = (gasEvents || 0) > 0;
  const y = doc.y;
  doc
    .roundedRect(50, y, doc.page.width - 100, 58, 8)
    .fill(alert ? COLORS.dangerBg : COLORS.successBg);
  doc
    .fillColor(alert ? COLORS.danger : COLORS.success)
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(
      alert
        ? `GAS SAFETY: ${gasEvents} EVENT(S) REQUIRE REVIEW`
        : "GAS SAFETY: NO EVENTS IN THIS PERIOD",
      66,
      y + 11,
    );
  doc
    .fillColor(COLORS.text)
    .fontSize(9)
    .font("Helvetica")
    .text(
      alert
        ? "Gas was detected during this period. Review the event log below and verify ventilation in the affected areas."
        : "No gas detections were recorded by gas-capable sensors during this period.",
      66,
      y + 31,
      { width: doc.page.width - 132 },
    );
  doc.y = y + 70;
}

// Bulleted findings list
function addBullets(doc, items) {
  items.forEach((t) => {
    const y = doc.y;
    doc.fillColor(COLORS.secondary).circle(56, y + 5, 2.5).fill();
    doc
      .fillColor(COLORS.text)
      .fontSize(10)
      .font("Helvetica")
      .text(t, 68, y, { width: doc.page.width - 118 });
    doc.moveDown(0.7);
  });
}

// Contents entries (drawn at the end on the reserved page via switchToPage)
function drawTocEntries(doc, toc) {
  doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
  doc
    .fillColor("#FFFFFF")
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Contents", 50, 16);
  doc.fillColor(COLORS.text);
  let y = 82;
  toc.forEach((s, i) => {
    doc
      .fillColor(COLORS.textLight)
      .fontSize(10)
      .font("Helvetica")
      .text(String(i + 1).padStart(2, "0"), 50, y);
    doc
      .fillColor(COLORS.ink)
      .fontSize(11)
      .font("Helvetica")
      .text(s.title, 82, y);
    doc
      .fillColor(COLORS.textLight)
      .fontSize(10)
      .text(String(s.page), 50, y, {
        align: "right",
        width: doc.page.width - 100,
      });
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(50, y + 17)
      .lineTo(doc.page.width - 50, y + 17)
      .stroke();
    y += 27;
  });
}

// Page footers for every page except the cover (drawn at the very end)
function drawFooters(doc, report) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (i === 0) continue;
    doc.fontSize(8).fillColor("#888888");
    const left = `TempGuard  |  Report #${report.id}`;
    const right = `Page ${i + 1} of ${range.count}`;
    doc.text(left, 50, doc.page.height - 35, { lineBreak: false });
    const w = doc.widthOfString(right);
    doc.text(right, doc.page.width - 50 - w, doc.page.height - 35, {
      lineBreak: false,
    });
  }
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
        bufferPages: true,
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

      // Section tracker for the Contents page (display numbers = pageNumber)
      const toc = [];
      const markSection = (title) => toc.push({ title, page: pageNumber });

      // Pre-computed safety figures (derived from reportData, no extra queries)
      const gasEventsTotal = reportData.readings?.gasEvents || 0;
      const allReadings = reportData.readings?.data || [];
      const gasList = allReadings.filter((r) => r.gas_detected);
      const gasCapable = (reportData.sensors?.data || []).filter(
        (s) => s.has_gas_sensor,
      );
      const lastGasAt = gasList.length
        ? new Date(
            Math.max(
              ...gasList.map((r) => new Date(r.createdAt).getTime()),
            ),
          )
        : null;
      const gasStreakDays = lastGasAt
        ? Math.floor((Date.now() - lastGasAt.getTime()) / 86400000)
        : null;
      const periodStr = `${new Date(report.date_range_start).toLocaleDateString()} - ${new Date(report.date_range_end).toLocaleDateString()}`;

      // ==================== COVER PAGE (page 1) ====================
      doc.rect(0, 0, doc.page.width, 148).fill(COLORS.primary);
      doc.rect(0, 148, doc.page.width, 4).fill(COLORS.secondary);
      doc
        .fillColor("#FFFFFF")
        .fontSize(15)
        .font("Helvetica-Bold")
        .text("TempGuard", 50, 30);
      doc
        .fontSize(9)
        .font("Helvetica")
        .text("Safety & Temperature Monitoring", 50, 50);
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(safe(report.type || "custom").toUpperCase() + " REPORT", 50, 30, {
          align: "right",
          width: doc.page.width - 100,
        });

      doc
        .fillColor(COLORS.ink)
        .fontSize(26)
        .font("Helvetica-Bold")
        .text(safe(report.title), 50, 190, { width: doc.page.width - 100 });
      doc
        .fillColor(COLORS.textLight)
        .fontSize(11)
        .font("Helvetica")
        .text(`Reporting period: ${periodStr}`, 50, doc.y + 6);

      // Meta card: two columns
      const metaY = doc.y + 30;
      doc
        .roundedRect(50, metaY, doc.page.width - 100, 96, 8)
        .fill(COLORS.background);
      doc.fillColor(COLORS.text).fontSize(10).font("Helvetica");
      const meta = [
        [`Report ID: #${report.id}`, `Type: ${safe(report.type || "custom")}`],
        [`Generated: ${new Date().toLocaleString()}`, `Sensors: ${reportData.sensors?.total || 0} (${gasCapable.length} gas-capable)`],
        [`Period: ${periodStr}`, `Readings: ${reportData.readings?.total || 0}  |  Gas events: ${gasEventsTotal}`],
      ];
      meta.forEach((row, ri) => {
        doc.text(row[0], 66, metaY + 16 + ri * 26);
        doc.text(row[1], doc.page.width / 2 + 10, metaY + 16 + ri * 26);
      });
      doc.y = metaY + 112;

      addVerdictBanner(doc, gasEventsTotal);

      doc
        .fillColor(COLORS.textLight)
        .fontSize(8)
        .font("Helvetica")
        .text("Confidential — prepared for internal safety review.", 50, doc.page.height - 60, {
          align: "center",
          width: doc.page.width - 100,
        });

      pageNumber++;
      doc.addPage();

      // ==================== CONTENTS (page 2, filled in at the end) ====================
      pageNumber++;
      doc.addPage();

      // ==================== EXECUTIVE SUMMARY ====================
      markSection("Executive Summary");
      doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
      doc
        .fillColor("#FFFFFF")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Executive Summary", 50, 16);
      doc
        .fontSize(9)
        .font("Helvetica")
        .text("TempGuard", 50, 18, {
          align: "right",
          width: doc.page.width - 100,
        });
      doc.fillColor(COLORS.text);
      doc.y = 64;
      safeAddSectionTitle(doc, "Key Performance Indicators");

      const cardWidth = (doc.page.width - 120) / 3;
      const kpiRow = (y, cards) => {
        cards.forEach((c, i) => {
          addMetricCard(
            doc,
            50 + i * cardWidth + (i > 0 ? i * 10 : 0),
            y,
            cardWidth - (i > 0 ? 0 : 0),
            c.title,
            c.value,
            c.color,
            c.icon,
          );
        });
      };
      const kpiY = doc.y;
      kpiRow(kpiY, [
        { title: "Total Sensors", value: reportData.sensors?.total || 0, color: COLORS.primary, icon: "S" },
        { title: "Total Readings", value: reportData.readings?.total || 0, color: COLORS.secondary, icon: "R" },
        { title: "Active Alerts", value: reportData.alerts?.total ?? reportData.readings?.alertsCount ?? 0, color: COLORS.accent, icon: "!" },
      ]);
      kpiRow(kpiY + 92, [
        { title: "Avg Temp", value: `${reportData.readings?.averageTemp || 0}C`, color: COLORS.primary, icon: "T" },
        { title: "Gas Events", value: gasEventsTotal, color: gasEventsTotal > 0 ? COLORS.danger : COLORS.success, icon: "G" },
        { title: "Overdue Tasks", value: reportData.maintenance?.overdue || 0, color: COLORS.warning, icon: "W" },
      ]);
      doc.y = kpiY + 184;

      safeAddSectionTitle(doc, "Key Findings");
      const findings = [
        `${reportData.readings?.total || 0} temperature readings collected from ${reportData.sensors?.total || 0} sensors (${gasCapable.length} gas-capable) between ${periodStr}.`,
        gasEventsTotal > 0
          ? `${gasEventsTotal} gas detection event(s) recorded${lastGasAt ? `, most recently on ${lastGasAt.toLocaleString()}` : ""}. Immediate review recommended.`
          : "No gas detections recorded in this period. Gas-capable sensors reported normally.",
        `${reportData.alerts?.total ?? reportData.readings?.alertsCount ?? 0} alert(s) triggered in period${reportData.alerts ? ` (${reportData.alerts.highTemp} high-temp, ${reportData.alerts.lowTemp} low-temp, ${reportData.alerts.gas} gas)` : ""} (readings min ${reportData.readings?.minTemp || 0}C / max ${reportData.readings?.maxTemp || 0}C).`,
        `${reportData.maintenance?.overdue || 0} maintenance task(s) overdue; ${reportData.maintenance?.completed || 0} completed in period.`,
      ];
      addBullets(doc, findings);

      pageNumber++;
      doc.addPage();

      // ==================== GAS SAFETY ====================
      markSection("Gas Safety");
      doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
      doc
        .fillColor("#FFFFFF")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Gas Safety", 50, 16);
      doc
        .fontSize(9)
        .font("Helvetica")
        .text("TempGuard", 50, 18, {
          align: "right",
          width: doc.page.width - 100,
        });
      doc.fillColor(COLORS.text);
      doc.y = 64;
      addVerdictBanner(doc, gasEventsTotal);

      if (gasCapable.length === 0) {
        doc
          .fillColor(COLORS.text)
          .fontSize(10)
          .font("Helvetica")
          .text(
            "No gas-capable sensors are registered. Gas monitoring can be enabled by setting a sensor's Type to \"Temperature + Gas\".",
            50,
            doc.y,
            { width: doc.page.width - 100 },
          );
      } else {
        safeAddSectionTitle(doc, "Gas-Capable Sensors");
        const gasSumHeaders = ["Sensor", "Location", "Readings", "Gas Events", "Last Event"];
        const gasSumWidths = [90, 130, 60, 65, 100];
        let gasY = addTableHeader(doc, gasSumHeaders, 50, doc.y, gasSumWidths);
        gasCapable.slice(0, 20).forEach((sensor, index) => {
          const sReadings = allReadings.filter((r) => String(r.sensor_id) === String(sensor.id));
          const sGas = sReadings.filter((r) => r.gas_detected);
          const sLast = sGas.length
            ? new Date(Math.max(...sGas.map((r) => new Date(r.createdAt).getTime()))).toLocaleString()
            : "Never";
          gasY = addTableRow(
            doc,
            [sensor.name || sensor.id, sensor.location_name || "N/A", String(sReadings.length), String(sGas.length), sLast],
            50,
            gasY,
            gasSumWidths,
            index % 2 === 1,
          );
        });
        doc.y = gasY + 10;

        safeAddSectionTitle(doc, "Gas Event Log");
        if (!gasList.length) {
          doc
            .fillColor(COLORS.text)
            .fontSize(10)
            .font("Helvetica")
            .text("No gas events in this period.", 50, doc.y);
        } else {
          const logHeaders = ["Date/Time", "Sensor", "Location", "Status"];
          const logWidths = [120, 100, 150, 75];
          let logY = addTableHeader(doc, logHeaders, 50, doc.y, logWidths);
          gasList.slice(0, 50).forEach((reading, index) => {
            if (logY > 700) {
              pageNumber++;
              doc.addPage();
              doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
              doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Gas Safety (Continued)", 50, 16);
              doc.fillColor(COLORS.text);
              doc.y = 64;
              logY = addTableHeader(doc, logHeaders, 50, doc.y, logWidths);
            }
            logY = addTableRow(
              doc,
              [
                new Date(reading.createdAt).toLocaleString(),
                reading.Sensor?.name || reading.sensor_id || "Unknown",
                reading.Sensor?.location_name || "N/A",
                "GAS DETECTED",
              ],
              50,
              logY,
              logWidths,
              index % 2 === 1,
            );
          });
          if (gasList.length > 50) {
            doc
              .fillColor(COLORS.textLight)
              .fontSize(9)
              .text(`* Showing first 50 of ${gasList.length} gas events`, 50, doc.y);
          }
        }
      }

      pageNumber++;
      doc.addPage();

      // ==================== SENSORS OVERVIEW PAGE ====================
      markSection("Sensors Overview");
      doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
      doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Sensors Overview", 50, 16);
      doc.fillColor(COLORS.text);
      doc.y = 64;
      safeAddSectionTitle(doc, "Sensor Distribution");

      const sensorHeaders = [
        "Sensor ID",
        "Name",
        "Type",
        "Status",
        "Location",
        "Last Reading",
      ];
      const sensorWidths = [60, 90, 70, 55, 90, 60];
      let currentY = doc.y;

      currentY = addTableHeader(doc, sensorHeaders, 50, currentY, sensorWidths);

      (reportData.sensors?.data || []).slice(0, 20).forEach((sensor, index) => {
        if (currentY > 700) {
          pageNumber++;
          doc.addPage();
          doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
          doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Sensors Overview (Continued)", 50, 16);
          doc.fillColor(COLORS.text);
          doc.y = 64;
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
            sensor.has_gas_sensor ? "Temp+Gas" : "Temp",
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

      pageNumber++;
      doc.addPage();

      // ==================== TEMPERATURE READINGS PAGE ====================
      if (reportData.readings && reportData.readings.data) {
        markSection("Temperature Analysis");
        doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
        doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Temperature Analysis", 50, 16);
        doc.fillColor(COLORS.text);
        doc.y = 64;
        safeAddSectionTitle(doc, "Temperature Statistics");

        const statsY = doc.y;
        const statBoxWidth = (doc.page.width - 120) / 5;

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
          {
            label: "Gas Events",
            value: reportData.readings.gasEvents || 0,
            color: COLORS.accent,
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
          "Gas",
          "Location",
        ];
        const readingWidths = [110, 90, 65, 45, 80];
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
            pageNumber++;
            doc.addPage();
            doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
            doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Temperature Analysis (Continued)", 50, 16);
            doc.fillColor(COLORS.text);
            doc.y = 64;
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
              reading.gas_detected === null || reading.gas_detected === undefined
                ? "N/A"
                : reading.gas_detected
                  ? "GAS"
                  : "0",
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

        // ── FIX 1: only add a new page when there IS a maintenance section to follow
        if (reportData.maintenance) { pageNumber++; doc.addPage(); }
      }

      // ==================== MAINTENANCE OVERVIEW PAGE ====================
      if (reportData.maintenance) {
        markSection("Maintenance Overview");
        doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
        doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Maintenance Overview", 50, 16);
        doc.fillColor(COLORS.text);
        doc.y = 64;
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
              pageNumber++;
              doc.addPage();
              doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
          doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Maintenance Overview (Continued)", 50, 16);
          doc.fillColor(COLORS.text);
          doc.y = 64;
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

        // ── FIX 1: only add a page when detailed tasks actually exist
        if (
          reportData.maintenance.data &&
          reportData.maintenance.data.length > 0
        ) {
          pageNumber++;
          doc.addPage();
          markSection("Maintenance Task Details");
          doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
          doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Maintenance Tasks Details", 50, 16);
          doc.fillColor(COLORS.text);
          doc.y = 64;
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
              pageNumber++;
              doc.addPage();
              doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
          doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Maintenance Tasks Details (Continued)", 50, 16);
          doc.fillColor(COLORS.text);
          doc.y = 64;
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
        }
      }

      // ==================== APPENDIX ====================
      pageNumber++;
      doc.addPage();
      markSection("Appendix: Methodology");
      doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
      doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Appendix: Methodology", 50, 16);
      doc.fillColor(COLORS.text);
      doc.y = 64;
      safeAddSectionTitle(doc, "How This Report Was Produced");
      addBullets(doc, [
        "Readings are collected hourly from registered sensors; each record carries temperature, GPS position and, for gas-capable sensors, a binary gas flag (1 = gas detected, 0 = clear).",
        "Sensors without gas hardware store no gas value (shown as N/A) so a 0 reading is never confused with missing hardware.",
        "Temperature alerts trigger when a reading exceeds the sensor's configured min/max thresholds; every gas detection raises a GAS alert.",
        `Reporting period: ${periodStr}. Figures on the cover and in the Executive Summary reflect this window.`,
        "Detailed tables show the first 100 readings and first 50 gas events; complete data is available in the JSON/CSV exports.",
      ]);

      // ==================== FINAL PAGE ====================
      // ── FIX 1: always add this page explicitly; the previous section's
      //    addPage() is gone — we add it here unconditionally.
      pageNumber++;
      doc.addPage();
      markSection("Conclusion & Recommendations");
      doc.rect(0, 0, doc.page.width, 46).fill(COLORS.primary);
      doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text("Report Summary", 50, 16);
      doc.fillColor(COLORS.text);
      doc.y = 64;
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
      if (reportData.readings?.gasEvents > 0) {
        recommendations.push(
          `Investigate ${reportData.readings.gasEvents} gas detection event(s) immediately and verify ventilation in affected areas`
        );
      }

      recommendations.forEach((rec) => {
        doc.fillColor(COLORS.text).fontSize(10).text(`- ${rec}`, 50, doc.y);
        doc.moveDown(0.5);
      });

      doc.moveDown(2);

      doc
        .fillColor(COLORS.textLight)
        .fontSize(8)
        .text(
          "This report was automatically generated by TempGuard.",
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

      // Fill the reserved Contents page (physical index 1) now that all
      // section page numbers are known, then stamp footers everywhere.
      doc.switchToPage(1);
      drawTocEntries(doc, toc);
      drawFooters(doc, report);

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
    workbook.creator = "TempGuard Monitoring System";
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
    summarySheet.addRow(["Gas Events", reportData.readings?.gasEvents || 0]);
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
      "Type",
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
        sensor.has_gas_sensor ? "Temperature + Gas" : "Temperature",
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
        "Gas",
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
          reading.gas_detected === null || reading.gas_detected === undefined
            ? "N/A"
            : reading.gas_detected
              ? "GAS"
              : "0",
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
