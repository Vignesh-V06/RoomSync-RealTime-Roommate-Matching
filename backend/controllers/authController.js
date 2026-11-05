const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/config');

const normalizeUsername = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._]/g, '')
  .slice(0, 30);

exports.register = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const phone = String(req.body.phone || '').trim() || null;
  let username = normalizeUsername(req.body.username || name.replace(/\s+/g, '.'));

  if (!name || name.length > 100) return res.status(400).json({ message: 'Enter a valid name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Password must contain 8 to 128 characters.' });
  }
  if (phone && !/^[+0-9() .-]{7,30}$/.test(phone)) {
    return res.status(400).json({ message: 'Enter a valid phone number.' });
  }
  if (username.length < 3) return res.status(400).json({ message: 'Username must contain at least 3 letters or numbers.' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'An account with this email already exists.' });

    const [taken] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (taken.length) return res.status(409).json({ message: 'That username is already taken.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, username, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name, username, email, phone, hashedPassword, 'student']
    );

    const user = { id: result.insertId, name, username, email, phone, role: 'student' };
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email or username is already in use.' });
    console.error('Registration failed:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
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

exports.directResetPassword = async (req, res) => {
  if (process.env.ALLOW_UNVERIFIED_PASSWORD_RESET !== 'true') {
    return res.status(501).json({
      message: 'Password reset is unavailable until a verified email or OTP reset flow is configured.'
    });
  }

  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ message: 'Password must contain 8 to 128 characters.' });
    }
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(404).json({ message: 'User with this email was not found.' });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password reset failed:', error);
    res.status(500).json({ message: 'Server error resetting password.' });
  }
};
