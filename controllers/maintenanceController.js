const MaintenanceTask = require("../models/maintenance");
const Sensor = require("../models/Sensor");
const { Op } = require("sequelize");

exports.scheduleMaintenance = async (req, res) => {
  try {
    const {
      sensor_id,
      title,
      type,
      dueDate,
      interval,
      priority,
      description,
      assigned_to,
    } = req.body;

    if (!sensor_id || !title || !dueDate || !interval) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const sensor = await Sensor.findOne({
      where: { id: sensor_id, user_id: req.user.id },
    });

    if (!sensor) {
      return res
        .status(404)
        .json({ error: "Sensor not found or unauthorized" });
    }

    const today = new Date().toISOString().split("T")[0];
    let initialStatus = "OK";
    if (dueDate < today) {
      initialStatus = "Overdue";
    }

    const newTask = await MaintenanceTask.create({
      sensor_id,
      title,
      type,
      dueDate,
      interval,
      priority: priority || "Medium",
      description,
      assigned_to,
      status: initialStatus,
      is_recurring: true,
      completion_count: 0,
    });

    res.status(201).json({ success: true, task: newTask });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to schedule maintenance task" });
  }
};

exports.getAllMaintenanceTasks = async (req, res) => {
  try {
    const { status, priority, sensor_id, includeCompleted = false } = req.query;

    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    } else if (!includeCompleted) {
      whereClause.status = { [Op.ne]: 'Completed' };
    }
    
    if (priority) whereClause.priority = priority;
    if (sensor_id) whereClause.sensor_id = sensor_id;

    const tasks = await MaintenanceTask.findAll({
      include: [
        {
          model: Sensor,
          where: { user_id: req.user.id },
          attributes: ["name", "status", "location_name"],
          required: true,
        },
      ],
      where: whereClause,
      order: [["dueDate", "ASC"]],
    });

    // Update statuses dynamically for non-completed tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updatedTasks = await Promise.all(
      tasks.map(async (task) => {
        if (task.status === "Completed") return task;

        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        let calculatedStatus = "OK";
        if (diffDays < 0) {
          calculatedStatus = "Overdue";
        } else if (diffDays <= 7) {
          calculatedStatus = "Due Soon";
        }

        if (task.status !== calculatedStatus) {
          task.status = calculatedStatus;
          await task.save();
        }
        return task;
      }),
    );

    res.json({ success: true, tasks: updatedTasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch maintenance tasks" });
  }
};

exports.getCompletedTasks = async (req, res) => {
  try {
    const { limit = 50, offset = 0, startDate, endDate } = req.query;
    
    const whereClause = {
      status: 'Completed'
    };
    
    if (startDate && endDate) {
      whereClause.completed_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    const tasks = await MaintenanceTask.findAll({
      include: [{
        model: Sensor,
        where: { user_id: req.user.id },
        attributes: ["name", "location_name"],
        required: true,
      }],
      where: whereClause,
      order: [["completed_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const total = await MaintenanceTask.count({
      include: [{
        model: Sensor,
        where: { user_id: req.user.id },
        required: true,
      }],
      where: whereClause,
    });

    res.json({ 
      success: true, 
      tasks,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + tasks.length < total
      }
    });
  } catch (error) {
    console.error("Get completed tasks error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getMaintenanceTaskById = async (req, res) => {
  try {
    const task = await MaintenanceTask.findByPk(req.params.id, {
      include: [
        {
          model: Sensor,
          where: { user_id: req.user.id },
        },
      ],
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateMaintenanceTask = async (req, res) => {
  try {
    const task = await MaintenanceTask.findByPk(req.params.id, {
      include: [Sensor],
    });

    if (!task || task.Sensor.user_id !== req.user.id) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Don't allow updating completed tasks
    if (task.status === "Completed") {
      return res.status(400).json({ error: "Cannot update completed tasks" });
    }

    await task.update(req.body);
    res.json({ success: true, message: "Task updated successfully", task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.completeMaintenanceTask = async (req, res) => {
  try {
    const { notes } = req.body;
    const task = await MaintenanceTask.findByPk(req.params.id, {
      include: [Sensor],
    });

    if (!task || task.Sensor.user_id !== req.user.id) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Mark current task as completed
    await task.update({
      status: "Completed",
      completed_at: new Date(),
      completed_by: req.user.username,
      notes: notes || task.notes,
    });

    let newTask = null;

    // Create a new task for the next cycle if recurring
    if (task.is_recurring !== false) {
      // Parse interval
      let daysToAdd = 30;
      const numericValue = parseInt(task.interval);
      if (!isNaN(numericValue)) {
        if (task.interval.toLowerCase().includes("month")) {
          daysToAdd = numericValue * 30;
        } else if (task.interval.toLowerCase().includes("week")) {
          daysToAdd = numericValue * 7;
        } else {
          daysToAdd = numericValue;
        }
      }

      const nextDueDate = new Date(task.dueDate);
      nextDueDate.setDate(nextDueDate.getDate() + daysToAdd);

      // Create new recurring task
      newTask = await MaintenanceTask.create({
        title: task.title,
        type: task.type,
        dueDate: nextDueDate.toISOString().split("T")[0],
        interval: task.interval,
        priority: task.priority,
        description: task.description,
        assigned_to: task.assigned_to,
        status: "OK",
        sensor_id: task.sensor_id,
        parent_task_id: task.id,
        is_recurring: true,
        completion_count: (task.completion_count || 0) + 1
      });
    }

    res.json({
      success: true,
      message: "Task completed successfully",
      completedTask: task,
      nextTask: newTask
    });
  } catch (error) {
    console.error("Complete task error:", error);
    res.status(500).json({ error: "Failed to complete task" });
  }
};

exports.skipMaintenanceTask = async (req, res) => {
  try {
    const { notes } = req.body;
    const task = await MaintenanceTask.findByPk(req.params.id, {
      include: [Sensor],
    });

    if (!task || task.Sensor.user_id !== req.user.id) {
      return res.status(404).json({ error: "Task not found" });
    }

    await task.update({
      status: "Skipped",
      completed_at: new Date(),
      completed_by: req.user.username,
      notes: notes || "Task skipped"
    });

    res.json({
      success: true,
      message: "Task skipped successfully",
      task
    });
  } catch (error) {
    console.error("Skip task error:", error);
    res.status(500).json({ error: "Failed to skip task" });
  }
};

exports.deleteMaintenanceTask = async (req, res) => {
  try {
    const task = await MaintenanceTask.findByPk(req.params.id, {
      include: [Sensor],
    });

    if (!task || task.Sensor.user_id !== req.user.id) {
      return res.status(404).json({ error: "Task not found" });
    }

    await task.destroy();
    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMaintenanceSummary = async (req, res) => {
  try {
    const tasks = await MaintenanceTask.findAll({
      include: [
        {
          model: Sensor,
          where: { user_id: req.user.id },
        },
      ],
    });

    const completedLast30Days = await MaintenanceTask.count({
      include: [{
        model: Sensor,
        where: { user_id: req.user.id },
        required: true,
      }],
      where: {
        status: 'Completed',
        completed_at: {
          [Op.gte]: new Date(new Date().setDate(new Date().getDate() - 30))
        }
      }
    });

    const summary = {
      total: tasks.filter(t => t.status !== 'Completed').length,
      overdue: tasks.filter((t) => t.status === "Overdue").length,
      dueSoon: tasks.filter((t) => t.status === "Due Soon").length,
      ok: tasks.filter((t) => t.status === "OK").length,
      completed: tasks.filter((t) => t.status === "Completed").length,
      skipped: tasks.filter((t) => t.status === "Skipped").length,
      completedLast30Days,
      byPriority: {
        low: tasks.filter((t) => t.priority === "Low").length,
        medium: tasks.filter((t) => t.priority === "Medium").length,
        high: tasks.filter((t) => t.priority === "High").length,
        critical: tasks.filter((t) => t.priority === "Critical").length,
      },
      byType: tasks.reduce((acc, t) => {
        if (t.status !== 'Completed') {
          acc[t.type] = (acc[t.type] || 0) + 1;
        }
        return acc;
      }, {})
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error("Get summary error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTaskHistory = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const tasks = await MaintenanceTask.findAll({
      include: [{
        model: Sensor,
        where: { user_id: req.user.id },
        attributes: ["name"],
        required: true,
      }],
      where: {
        [Op.or]: [
          { id: taskId },
          { parent_task_id: taskId }
        ]
      },
      order: [["createdAt", "ASC"]],
    });

    res.json({ success: true, tasks });
  } catch (error) {
    console.error("Get task history error:", error);
    res.status(500).json({ error: error.message });
  }
};






// const MaintenanceTask = require("../models/maintenance");
// const Sensor = require("../models/Sensor");
// const { Op } = require("sequelize");

// exports.scheduleMaintenance = async (req, res) => {
//   try {
//     const {
//       sensor_id,
//       title,
//       type,
//       dueDate,
//       interval,
//       priority,
//       description,
//       assigned_to,
//     } = req.body;

//     if (!sensor_id || !title || !dueDate || !interval) {
//       return res.status(400).json({ error: "Required fields missing" });
//     }

//     const sensor = await Sensor.findOne({
//       where: { id: sensor_id, user_id: req.user.id },
//     });

//     if (!sensor) {
//       return res
//         .status(404)
//         .json({ error: "Sensor not found or unauthorized" });
//     }

//     const today = new Date().toISOString().split("T")[0];
//     let initialStatus = "OK";
//     if (dueDate < today) {
//       initialStatus = "Overdue";
//     }

//     const newTask = await MaintenanceTask.create({
//       sensor_id,
//       title,
//       type,
//       dueDate,
//       interval,
//       priority: priority || "Medium",
//       description,
//       assigned_to,
//       status: initialStatus,
//     });

//     res.status(201).json({ success: true, task: newTask });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to schedule maintenance task" });
//   }
// };

// exports.getAllMaintenanceTasks = async (req, res) => {
//   try {
//     const { status, priority, sensor_id } = req.query;

//     const whereClause = {};
//     if (status) whereClause.status = status;
//     if (priority) whereClause.priority = priority;

//     const tasks = await MaintenanceTask.findAll({
//       include: [
//         {
//           model: Sensor,
//           where: { user_id: req.user.id },
//           attributes: ["name", "status", "location_name"],
//         },
//       ],
//       where: sensor_id ? { ...whereClause, sensor_id } : whereClause,
//       order: [["dueDate", "ASC"]],
//     });

//     // Update statuses dynamically
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const updatedTasks = await Promise.all(
//       tasks.map(async (task) => {
//         if (task.status === "Completed") return task;

//         const dueDate = new Date(task.dueDate);
//         dueDate.setHours(0, 0, 0, 0);
//         const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

//         let calculatedStatus = "OK";
//         if (diffDays < 0) {
//           calculatedStatus = "Overdue";
//         } else if (diffDays <= 7) {
//           calculatedStatus = "Due Soon";
//         }

//         if (task.status !== calculatedStatus) {
//           task.status = calculatedStatus;
//           await task.save();
//         }
//         return task;
//       }),
//     );

//     res.json({ success: true, tasks: updatedTasks });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to fetch maintenance tasks" });
//   }
// };

// exports.getMaintenanceTaskById = async (req, res) => {
//   try {
//     const task = await MaintenanceTask.findByPk(req.params.id, {
//       include: [
//         {
//           model: Sensor,
//           where: { user_id: req.user.id },
//         },
//       ],
//     });

//     if (!task) {
//       return res.status(404).json({ error: "Task not found" });
//     }

//     res.json({ success: true, task });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// exports.updateMaintenanceTask = async (req, res) => {
//   try {
//     const task = await MaintenanceTask.findByPk(req.params.id, {
//       include: [Sensor],
//     });

//     if (!task || task.Sensor.user_id !== req.user.id) {
//       return res.status(404).json({ error: "Task not found" });
//     }

//     await task.update(req.body);
//     res.json({ success: true, message: "Task updated successfully", task });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// exports.completeMaintenanceTask = async (req, res) => {
//   try {
//     const task = await MaintenanceTask.findByPk(req.params.id, {
//       include: [Sensor],
//     });

//     if (!task || task.Sensor.user_id !== req.user.id) {
//       return res.status(404).json({ error: "Task not found" });
//     }

//     // Parse interval
//     let daysToAdd = 30;
//     const numericValue = parseInt(task.interval);
//     if (!isNaN(numericValue)) {
//       if (task.interval.toLowerCase().includes("month")) {
//         daysToAdd = numericValue * 30;
//       } else if (task.interval.toLowerCase().includes("week")) {
//         daysToAdd = numericValue * 7;
//       } else {
//         daysToAdd = numericValue;
//       }
//     }

//     const nextDueDate = new Date(task.dueDate);
//     nextDueDate.setDate(nextDueDate.getDate() + daysToAdd);

//     await task.update({
//       dueDate: nextDueDate.toISOString().split("T")[0],
//       status: "OK",
//       completed_at: new Date(),
//     });

//     res.json({
//       success: true,
//       message: "Task completed and rescheduled",
//       nextDueDate: task.dueDate,
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to complete task" });
//   }
// };

// exports.deleteMaintenanceTask = async (req, res) => {
//   try {
//     const task = await MaintenanceTask.findByPk(req.params.id, {
//       include: [Sensor],
//     });

//     if (!task || task.Sensor.user_id !== req.user.id) {
//       return res.status(404).json({ error: "Task not found" });
//     }

//     await task.destroy();
//     res.json({ success: true, message: "Task deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// exports.getMaintenanceSummary = async (req, res) => {
//   try {
//     const tasks = await MaintenanceTask.findAll({
//       include: [
//         {
//           model: Sensor,
//           where: { user_id: req.user.id },
//         },
//       ],
//     });

//     const summary = {
//       total: tasks.length,
//       overdue: tasks.filter((t) => t.status === "Overdue").length,
//       dueSoon: tasks.filter((t) => t.status === "Due Soon").length,
//       ok: tasks.filter((t) => t.status === "OK").length,
//       completed: tasks.filter((t) => t.status === "Completed").length,
//       byPriority: {
//         low: tasks.filter((t) => t.priority === "Low").length,
//         medium: tasks.filter((t) => t.priority === "Medium").length,
//         high: tasks.filter((t) => t.priority === "High").length,
//         critical: tasks.filter((t) => t.priority === "Critical").length,
//       },
//     };

//     res.json({ success: true, summary });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
