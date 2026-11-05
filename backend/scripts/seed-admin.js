require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db/config');

const run = async () => {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = String(process.env.ADMIN_NAME || 'RoomSync Administrator').trim();
  const username = String(process.env.ADMIN_USERNAME || 'roomsync.admin').trim().toLowerCase();

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the backend environment before seeding the administrator.');
  }
  if (password.length < 14) {
    throw new Error('ADMIN_PASSWORD must be at least 14 characters. Use a unique password manager-generated value.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length) {
    await pool.query(
      'UPDATE users SET name = ?, username = ?, password = ?, role = ? WHERE id = ?',
      [name, username, passwordHash, 'admin', existing[0].id]
    );
    process.stdout.write('Administrator account credentials refreshed for ' + email + '.\n');
  } else {
    await pool.query(
      'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, username, email, passwordHash, 'admin']
    );
    process.stdout.write('Administrator account created for ' + email + '.\n');
  }
};

run()
  .catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
