const pool = require('../db/config');

const normalizeCustomPreferences = (value) => {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { source = {}; }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.entries(source).slice(0, 12).reduce((result, entry) => {
    const key = String(entry[0]).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    const preference = String(entry[1] || '').trim().slice(0, 100);
    if (key && preference) result[key] = preference;
    return result;
  }, {});
};

exports.getProfile = async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (String(req.user.id) !== String(targetId) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only view your own profile here.' });
    }

    const [profiles] = await pool.query(
      'SELECT p.*, u.name AS user_name, u.username, u.email AS user_email, u.phone FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ? LIMIT 1',
      [targetId]
    );
    if (!profiles.length) return res.status(404).json({ message: 'Profile not found.' });
    profiles[0].custom_preferences = normalizeCustomPreferences(profiles[0].custom_preferences);
    res.json(profiles[0]);
  } catch (error) {
    console.error('Profile read failed:', error);
    res.status(500).json({ message: 'Server error retrieving profile.' });
  }
};

exports.upsertProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      language, branch, cgpa_range, bed_pref, expected_members,
      sleep_pref, study_pref, food_pref, cleanliness,
      bio, skills, interests, academic_details
    } = req.body;
    const phone = String(req.body.phone || '').trim() || null;
    if (phone && !/^[+0-9() .-]{7,30}$/.test(phone)) {
      return res.status(400).json({ message: 'Enter a valid phone number (7 to 30 characters).' });
    }
    const customPreferences = normalizeCustomPreferences(req.body.custom_preferences);
    await pool.query('UPDATE users SET phone = ? WHERE id = ?', [phone, userId]);

    const [existing] = await pool.query('SELECT user_id FROM profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (existing.length) {
      await pool.query(
        'UPDATE profiles SET language=?, branch=?, cgpa_range=?, bed_pref=?, expected_members=?, sleep_pref=?, study_pref=?, food_pref=?, cleanliness=?, bio=?, skills=?, interests=?, academic_details=?, custom_preferences=? WHERE user_id=?',
        [language || null, branch || null, cgpa_range || null, bed_pref || null, Number(expected_members) || null, sleep_pref || null, study_pref || null, food_pref || null, cleanliness || null, bio || null, skills || null, interests || null, academic_details || null, JSON.stringify(customPreferences), userId]
      );
      return res.json({ message: 'Profile updated successfully.', phone, custom_preferences: customPreferences });
    }

    await pool.query(
      'INSERT INTO profiles (user_id, language, branch, cgpa_range, bed_pref, expected_members, sleep_pref, study_pref, food_pref, cleanliness, bio, skills, interests, academic_details, custom_preferences) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, language || null, branch || null, cgpa_range || null, bed_pref || null, Number(expected_members) || null, sleep_pref || null, study_pref || null, food_pref || null, cleanliness || null, bio || null, skills || null, interests || null, academic_details || null, JSON.stringify(customPreferences)]
    );
    res.status(201).json({ message: 'Profile created successfully.', phone, custom_preferences: customPreferences });
  } catch (error) {
    console.error('Profile save failed:', error);
    res.status(500).json({ message: 'Server error saving profile.' });
  }
};
