const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MaintenanceTask = sequelize.define('MaintenanceTask', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Inspection'
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  interval: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('OK', 'Due Soon', 'Overdue', 'Completed', 'Skipped'),
    allowNull: false,
    defaultValue: 'OK'
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
    defaultValue: 'Medium'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assigned_to: {
    type: DataTypes.STRING,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  parent_task_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'MaintenanceTasks',
      key: 'id'
    }
  },
  is_recurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  completion_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true
});

module.exports = MaintenanceTask;










// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/database");

// const MaintenanceTask = sequelize.define(
//   "MaintenanceTask",
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       primaryKey: true,
//     },
//     title: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     type: {
//       type: DataTypes.STRING,
//       allowNull: false,
//       defaultValue: "Inspection",
//     },
//     dueDate: {
//       type: DataTypes.DATEONLY,
//       allowNull: false,
//     },
//     interval: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     status: {
//       type: DataTypes.ENUM("OK", "Due Soon", "Overdue", "Completed"),
//       allowNull: false,
//       defaultValue: "OK",
//     },
//     priority: {
//       type: DataTypes.ENUM("Low", "Medium", "High", "Critical"),
//       defaultValue: "Medium",
//     },
//     description: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//     },
//     assigned_to: {
//       type: DataTypes.STRING,
//       allowNull: true,
//     },
//     completed_at: {
//       type: DataTypes.DATE,
//       allowNull: true,
//     },
//     notes: {
//       type: DataTypes.TEXT,
//       allowNull: true,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// module.exports = MaintenanceTask;
