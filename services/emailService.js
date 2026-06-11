const { getTransporter } = require('../config/emailConfig');
const User = require('../models/User');
const Sensor = require('../models/Sensor');
const { Op } = require('sequelize');

// Get recipients for a maintenance task
const getTaskRecipients = async (task, sensor) => {
  const recipients = new Set();
  
  // 1. Add assigned technician if specified
  if (task.assigned_to) {
    // Check if assigned_to is an email or just a name
    if (task.assigned_to.includes('@')) {
      recipients.add(task.assigned_to);
    } else {
      // Try to find user by name
      const user = await User.findOne({
        where: {
          fullName: task.assigned_to,
          status: 'active'
        }
      });
      if (user && user.email) {
        recipients.add(user.email);
      }
    }
  }
  
  // 2. Add sensor owner (user who owns the sensor)
  if (sensor && sensor.user_id) {
    const sensorOwner = await User.findByPk(sensor.user_id, {
      attributes: ['email']
    });
    if (sensorOwner && sensorOwner.email) {
      recipients.add(sensorOwner.email);
    }
  }
  
  // 3. Add all admin users
  const adminUsers = await User.findAll({
    where: {
      role: 'admin',
      status: 'active'
    },
    attributes: ['email']
  });
  adminUsers.forEach(admin => {
    if (admin.email) recipients.add(admin.email);
  });
  
  // 4. Add default alert emails from .env
  if (process.env.ALERT_EMAILS) {
    const defaultEmails = process.env.ALERT_EMAILS.split(',');
    defaultEmails.forEach(email => {
      if (email.trim()) recipients.add(email.trim());
    });
  }
  
  // 5. If no recipients found, use a default fallback
  if (recipients.size === 0 && process.env.EMAIL_USER) {
    recipients.add(process.env.EMAIL_USER);
  }
  
  return Array.from(recipients);
};

const sendMaintenanceAlert = async (task, sensor, status) => {
  const transporter = getTransporter();
  
  if (!transporter) {
    console.log(`📧 [SIMULATED] Would send ${status} alert for task: ${task.title}`);
    console.log(`   Task: ${task.title}`);
    console.log(`   Sensor: ${sensor?.name || 'N/A'}`);
    console.log(`   Due Date: ${new Date(task.dueDate).toLocaleDateString()}`);
    return { success: false, error: 'Email not configured', simulated: true };
  }
  
  // Get recipients for this task
  const recipients = await getTaskRecipients(task, sensor);
  
  if (recipients.length === 0) {
    console.log(`⚠️ No recipients found for task ${task.id}`);
    return { success: false, error: 'No recipients found' };
  }
  
  console.log(`📧 Sending to: ${recipients.join(', ')}`);
  
  const subject = status === 'overdue' 
    ? `⚠️ OVERDUE: Maintenance Task - ${task.title}`
    : `🔔 REMINDER: Maintenance Due Soon - ${task.title}`;

  const color = status === 'overdue' ? '#E76F51' : '#F4A261';
  const urgency = status === 'overdue' ? 'OVERDUE' : 'Due Soon';

  // Build assigned to section
  const assignedToHtml = task.assigned_to ? `
    <div class="detail-row">
      <span class="label">Assigned To:</span> ${task.assigned_to}
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .task-details { background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #555; width: 120px; display: inline-block; }
        .priority-high { color: #E76F51; font-weight: bold; }
        .priority-critical { color: #D9534F; font-weight: bold; }
        .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
        .recipients { background-color: #f0f0f0; padding: 10px; border-radius: 5px; margin-top: 15px; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${subject}</h2>
        </div>
        <div class="content">
          <p>Dear Maintenance Team,</p>
          <p>The following maintenance task is ${status === 'overdue' ? 'past its due date' : 'approaching its due date'}:</p>
          
          <div class="task-details">
            <div class="detail-row">
              <span class="label">Task:</span> <strong>${task.title}</strong>
            </div>
            <div class="detail-row">
              <span class="label">Sensor:</span> ${sensor?.name || 'N/A'}
            </div>
            <div class="detail-row">
              <span class="label">Location:</span> ${sensor?.location_name || 'N/A'}
            </div>
            <div class="detail-row">
              <span class="label">Due Date:</span> ${new Date(task.dueDate).toLocaleDateString()}
            </div>
            <div class="detail-row">
              <span class="label">Priority:</span> 
              <span class="priority-${task.priority?.toLowerCase()}">${task.priority || 'Medium'}</span>
            </div>
            ${assignedToHtml}
            <div class="detail-row">
              <span class="label">Type:</span> ${task.type}
            </div>
            ${task.description ? `
            <div class="detail-row">
              <span class="label">Description:</span> ${task.description}
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">Status:</span> <strong style="color: ${color}">${urgency}</strong>
            </div>
          </div>
          
          <p>Please take action on this task as soon as possible.</p>
          
          <div class="recipients">
            <strong>This alert was sent to:</strong><br/>
            ${recipients.join('<br/>')}
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message from the Temperature Monitoring System.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    ${subject}
    
    Task: ${task.title}
    Sensor: ${sensor?.name || 'N/A'}
    Due Date: ${new Date(task.dueDate).toLocaleDateString()}
    Priority: ${task.priority || 'Medium'}
    Status: ${urgency}
    ${task.assigned_to ? `Assigned To: ${task.assigned_to}` : ''}
    
    Please take action on this task as soon as possible.
    
    This alert was sent to: ${recipients.join(', ')}
  `;

  try {
    const info = await transporter.sendMail({
      from: `"TempGuard Monitor" <${process.env.EMAIL_USER || 'tempguard@test.com'}>`,
      to: recipients.join(', '),
      subject: subject,
      text: text,
      html: html,
    });
    
    console.log(`✅ Alert email sent for task ${task.id} to ${recipients.length} recipient(s)`);
    if (info.previewUrl) {
      console.log(`   Preview: ${info.previewUrl}`);
    }
    
    return { success: true, messageId: info.messageId, recipients: recipients.length, previewUrl: info.previewUrl };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendMaintenanceAlert };