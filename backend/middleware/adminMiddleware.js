const pool = require('../db/config');

const adminMiddleware = async (req, res, next) => {
  try {
    const [users] = await pool.query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!users.length || users[0].role !== 'admin') {
      return res.status(403).json({ message: 'Administrator access is required.' });
    }
    req.user.role = 'admin';
    return next();
  } catch (error) {
    console.error('Admin authorization failed:', error);
    return res.status(500).json({ message: 'Could not verify administrator access.' });
  }
};

module.exports = adminMiddleware;
