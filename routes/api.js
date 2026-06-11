const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");

// Controllers
const authController = require("../controllers/authController");
const sensorController = require("../controllers/sensorController");
const maintenanceController = require("../controllers/maintenanceController");
const dashboardController = require("../controllers/dashboardController");
const analyticsController = require("../controllers/analyticsController");
const userController = require("../controllers/userController");
const reportController = require("../controllers/reportController");

// ==================== AUTH ROUTES ====================
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.post("/auth/logout", authController.logout);
router.get("/auth/profile", authenticateToken, authController.getProfile);

// ==================== DASHBOARD ROUTES ====================
router.get("/dashboard/stats", authenticateToken, dashboardController.getDashboardStats);
router.get("/dashboard/trends", authenticateToken, dashboardController.getTemperatureTrends);

// ==================== SENSOR ROUTES ====================
router.get("/sensors", authenticateToken, sensorController.getAllSensors);
router.get("/sensors/map", authenticateToken, sensorController.getSensorsMap);
router.get("/sensors/:id", authenticateToken, sensorController.getSensorById);
router.get("/sensors/:id/stats", authenticateToken, sensorController.getSensorStats);
router.post("/sensors", authenticateToken, sensorController.createSensor);
router.put("/sensors/:id", authenticateToken, sensorController.updateSensor);
router.delete("/sensors/:id", authenticateToken, sensorController.deleteSensor);

// Sensor readings routes
router.get("/sensors/:id/readings", authenticateToken, async (req, res) => {
  // Keep existing implementation
});

// ==================== MAINTENANCE ROUTES ====================
// ==================== MAINTENANCE ROUTES ====================
router.get("/maintenance", authenticateToken, maintenanceController.getAllMaintenanceTasks);
router.get("/maintenance/completed", authenticateToken, maintenanceController.getCompletedTasks);
router.get("/maintenance/summary", authenticateToken, maintenanceController.getMaintenanceSummary);
router.get("/maintenance/history/:taskId", authenticateToken, maintenanceController.getTaskHistory);
router.get("/maintenance/:id", authenticateToken, maintenanceController.getMaintenanceTaskById);
router.post("/maintenance", authenticateToken, maintenanceController.scheduleMaintenance);
router.put("/maintenance/:id", authenticateToken, maintenanceController.updateMaintenanceTask);
router.post("/maintenance/:id/complete", authenticateToken, maintenanceController.completeMaintenanceTask);
router.post("/maintenance/:id/skip", authenticateToken, maintenanceController.skipMaintenanceTask);
router.delete("/maintenance/:id", authenticateToken, maintenanceController.deleteMaintenanceTask);
// router.get("/maintenance", authenticateToken, maintenanceController.getAllMaintenanceTasks);
// router.get("/maintenance/summary", authenticateToken, maintenanceController.getMaintenanceSummary);
// router.get("/maintenance/:id", authenticateToken, maintenanceController.getMaintenanceTaskById);
// router.post("/maintenance", authenticateToken, maintenanceController.scheduleMaintenance);
// router.put("/maintenance/:id", authenticateToken, maintenanceController.updateMaintenanceTask);
// router.post("/maintenance/:id/complete", authenticateToken, maintenanceController.completeMaintenanceTask);
// router.delete("/maintenance/:id", authenticateToken, maintenanceController.deleteMaintenanceTask);

// ==================== ANALYTICS ROUTES ====================
router.get("/analytics/summary", authenticateToken, analyticsController.getAnalyticsSummary);
router.get("/analytics/hourly", authenticateToken, analyticsController.getHourlyAnalytics);
router.get("/analytics/comparison", authenticateToken, analyticsController.getSensorComparison);

// ==================== USER MANAGEMENT ROUTES ====================

// Admin routes
router.get("/admin/users", authenticateToken, userController.getAllUsers);
router.get("/admin/users/stats", authenticateToken, userController.getUserStats);
router.post("/admin/users", authenticateToken, userController.createUser);
router.put("/admin/users/:id", authenticateToken, userController.updateUser);
router.delete("/admin/users/:id", authenticateToken, userController.deleteUser);

// User profile routes
router.get("/users/profile", authenticateToken, userController.getCurrentUser);
router.get("/users/:id", authenticateToken, userController.getUserById);
router.put("/users/profile", authenticateToken, userController.updateProfile);
router.post("/users/change-password", authenticateToken, userController.changePassword);

// ==================== REPORT ROUTES ====================
router.get("/reports", authenticateToken, reportController.getReports);
router.get("/reports/:id", authenticateToken, reportController.getReportById);
router.post("/reports", authenticateToken, reportController.generateReport);
router.delete("/reports/:id", authenticateToken, reportController.deleteReport);
router.get("/reports/:id/download", authenticateToken, reportController.downloadReportFile);


module.exports = router;