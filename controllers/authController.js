const User = require("../models/User");
const jwt = require("jsonwebtoken");

// NOTE: self-registration is intentionally disabled. User accounts may only
// be created by an administrator via POST /admin/users. The initial admin
// account is seeded on first boot (see server.js).
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });

    if (!user || !(await user.validPassword(password))) {
      console.warn(`Failed login attempt for username '${username}'`);
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

exports.logout = (req, res) => {
  return res.json({
    success: true,
    message:
      "Logout successful. Please delete the token from client-side storage.",
  });
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
