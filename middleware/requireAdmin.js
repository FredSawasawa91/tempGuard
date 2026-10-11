// Requires an authenticated admin. Must be chained AFTER authenticateToken,
// which already loads a fresh { id, username, role } from the database.
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Access Denied: No Token Provided' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied: administrators only' });
  }
  next();
};

module.exports = requireAdmin;
