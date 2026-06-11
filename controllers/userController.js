const User = require("../models/User");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });
    res.json({ success: true, users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  console.log('getCurrentUser called, user:', req.user);
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    console.log('Found user:', user);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get single user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if admin or requesting own profile
    if (req.user.role !== "admin" && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Create new user (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, fullName, role, phoneNumber } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }

    const user = await User.create({
      username,
      email,
      password,
      fullName,
      role: role || "user",
      phoneNumber,
      status: "active",
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({ success: true, user: userResponse });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Non-admins cannot change role
    if (req.user.role !== "admin" && req.body.role) {
      delete req.body.role;
    }

    // Check if email/username already taken (for other users)
    if (req.body.email || req.body.username) {
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [],
          id: { [Op.ne]: req.params.id },
        },
      });

      if (req.body.email) {
        const emailExists = await User.findOne({
          where: { email: req.body.email, id: { [Op.ne]: req.params.id } },
        });
        if (emailExists) {
          return res.status(400).json({ error: "Email already in use" });
        }
      }

      if (req.body.username) {
        const usernameExists = await User.findOne({
          where: {
            username: req.body.username,
            id: { [Op.ne]: req.params.id },
          },
        });
        if (usernameExists) {
          return res.status(400).json({ error: "Username already in use" });
        }
      }
    }

    // Handle password update
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    }

    await user.update(req.body);

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    await user.destroy();
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Update own profile
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const allowedUpdates = [
      "fullName",
      "phoneNumber",
      "avatar",
      "email",
      "username",
    ];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Check if email/username already taken
    if (updates.email) {
      const emailExists = await User.findOne({
        where: { email: updates.email, id: { [Op.ne]: req.user.id } },
      });
      if (emailExists) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    if (updates.username) {
      const usernameExists = await User.findOne({
        where: { username: updates.username, id: { [Op.ne]: req.user.id } },
      });
      if (usernameExists) {
        return res.status(400).json({ error: "Username already in use" });
      }
    }

    await user.update(updates);

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isValid = await user.validPassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get user statistics (Admin only)
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: "active" } });
    const adminUsers = await User.count({ where: { role: "admin" } });
    const regularUsers = await User.count({ where: { role: "user" } });

    res.json({
      success: true,
      stats: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
        regularUsers: regularUsers,
      },
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ error: error.message });
  }
};
