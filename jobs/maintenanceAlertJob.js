// const cron = require('node-cron');
// const { Op } = require('sequelize');
// const MaintenanceTask = require('../models/maintenance');
// const Sensor = require('../models/Sensor');
// const { sendMaintenanceAlert } = require('../services/emailService');

// // Track sent alerts to avoid duplicates
// const sentAlerts = new Map();

// const checkAndSendAlerts = async () => {
//   console.log('🔍 Running maintenance alert check...', new Date().toISOString());
  
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
  
//   const sevenDaysFromNow = new Date(today);
//   sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
//   try {
//     // Find tasks that are due soon (within 7 days) or overdue
//     const tasks = await MaintenanceTask.findAll({
//       where: {
//         status: {
//           [Op.ne]: 'Completed' // Don't alert for completed tasks
//         },
//         dueDate: {
//           [Op.lte]: sevenDaysFromNow
//         }
//       },
//       include: [{
//         model: Sensor,
//         attributes: ['name', 'location_name', 'status']
//       }]
//     });
    
//     console.log(`📋 Found ${tasks.length} tasks requiring attention`);
    
//     for (const task of tasks) {
//       const dueDate = new Date(task.dueDate);
//       dueDate.setHours(0, 0, 0, 0);
//       const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
//       let alertType = null;
//       if (diffDays < 0) {
//         alertType = 'overdue';
//       } else if (diffDays <= 7) {
//         alertType = 'due_soon';
//       }
      
//       if (alertType) {
//         // Check if we already sent an alert for this task today
//         const lastAlertDate = sentAlerts.get(task.id);
//         const todayStr = today.toISOString().split('T')[0];
        
//         if (!lastAlertDate || lastAlertDate !== todayStr) {
//           console.log(`📧 Sending ${alertType} alert for task: ${task.title} (${diffDays} days remaining)`);
          
//           // Send email alert
//           const result = await sendMaintenanceAlert(task, task.Sensor, alertType);
          
//           if (result.success) {
//             sentAlerts.set(task.id, todayStr);
            
//             // Update task status if needed
//             if (alertType === 'overdue' && task.status !== 'Overdue') {
//               await task.update({ status: 'Overdue' });
//               console.log(`   ✓ Task marked as Overdue`);
//             } else if (alertType === 'due_soon' && task.status !== 'Due Soon') {
//               await task.update({ status: 'Due Soon' });
//               console.log(`   ✓ Task marked as Due Soon`);
//             }
//           }
//         }
//       }
//     }
    
//     // Clean up old entries from sentAlerts (keep only last 7 days)
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
//     for (const [taskId, alertDate] of sentAlerts.entries()) {
//       if (new Date(alertDate) < sevenDaysAgo) {
//         sentAlerts.delete(taskId);
//       }
//     }
    
//     console.log(`✅ Alert check completed. Processed ${tasks.length} tasks.`);
//   } catch (error) {
//     console.error('❌ Error in maintenance alert job:', error);
//   }
// };

// // Schedule the job to run daily at 10:55 PM
// const startMaintenanceAlertJob = () => {
//   // Cron pattern: 55 22 * * *
//   // 55 = minute 55
//   // 22 = hour 22 (10 PM)
//   // * = every day
//   // * = every month
//   // * = every day of week
//   cron.schedule('03 23 * * *', () => {
//     console.log('⏰ Running scheduled maintenance alert check (10:55 PM)');
//     checkAndSendAlerts();
//   });
  
//   console.log('⏰ Maintenance alert job scheduled to run daily at 10:55 PM');
// };

// // For testing purposes - run immediately
// const runNow = async () => {
//   console.log('🚀 Manually triggering maintenance alert check');
//   await checkAndSendAlerts();
// };

// module.exports = { startMaintenanceAlertJob, checkAndSendAlerts, runNow };