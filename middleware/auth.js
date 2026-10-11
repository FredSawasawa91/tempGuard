const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/User');

// Verifies the Bearer token, then loads the user fresh from the database so
// role/status changes (demotion, deactivation) take effect immediately —
// stale 24h tokens cannot retain elevated access. Inactive or deleted users
// are rejected on every request.
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Expecting format: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access Denied: No Token Provided' });
  }

  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or Expired Token' });
  }

  try {
    const user = await User.findByPk(verified.id, {
      attributes: ['id', 'username', 'role', 'status'],
    });
    if (!user) {
      return res.status(403).json({ success: false, message: 'Account no longer exists' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

module.exports = authenticateToken;
