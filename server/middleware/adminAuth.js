const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ success: false, error: 'No token provided.' });

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user)
      return res.status(401).json({ success: false, error: 'User not found.' });

    if (user.isBanned)
      return res.status(403).json({ success: false, error: 'Account is banned.' });

    // 403 (not 401) when authenticated but not admin
    if (user.role !== 'admin')
      return res.status(403).json({ success: false, error: 'Admin access required.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    next(err);
  }
};
