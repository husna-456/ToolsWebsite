const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── POST /api/auth/login ──────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });

    if (user.isBanned)
      return res.status(403).json({ success: false, error: 'Account is banned.' });

    const match = await user.matchPassword(password);
    if (!match)
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        plan:  user.plan,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login };
