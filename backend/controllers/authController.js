const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/config');
const recordActivity = require('../utils/activityLogger');

const normalizeUsername = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._]/g, '')
  .slice(0, 30);

exports.register = async (req, res) => {
  return res.status(410).json({
    message: 'Direct registration is disabled. Request and verify your email OTP to create your RoomSync account.'
  });
};

exports.login = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  try {
    const [users] = await pool.query(
      'SELECT id, name, username, email, phone, password, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (!users.length) return res.status(400).json({ message: 'Invalid credentials.' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    await recordActivity({ actorUserId: user.id, subjectUserId: user.id, eventType: 'user_logged_in', entityType: 'user', entityId: user.id });
    const safeUser = {
      id: user.id,
      name: user.name,
      username: user.username || String(user.email).split('@')[0],
      email: user.email,
      phone: user.phone || null,
      role: user.role
    };
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};
