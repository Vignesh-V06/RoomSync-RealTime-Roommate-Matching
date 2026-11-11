const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/config');
const recordActivity = require('../utils/activityLogger');
const { getEmailProvider, getEmailProviderStatus, sendEmail } = require('../utils/emailDelivery');
const { normalizeEmail, createRegistrationOtpHash, safeCompareHex, isValidOtp } = require('../utils/registrationOtp');

const normalizeUsername = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._]/g, '')
  .slice(0, 30);

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const getUniqueUsername = async (connection, name) => {
  const normalized = normalizeUsername(String(name || '').replace(/\s+/g, '.'));
  const base = (normalized.length >= 3 ? normalized : 'student.' + normalized).slice(0, 24);
  for (let suffix = 1; suffix <= 9999; suffix += 1) {
    const candidate = suffix === 1 ? base : base.slice(0, 29 - String(suffix).length) + '.' + suffix;
    const [matches] = await connection.query('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
    if (!matches.length) return candidate;
  }
  throw new Error('Could not create a unique username.');
};

const buildRegistrationEmail = ({ name, otp }) => ({
  subject: 'Verify your RoomSync email address',
  text: 'Hi ' + name + ', your RoomSync verification code is ' + otp + '. It expires in 10 minutes and can only be used once. If you did not start this registration, ignore this email.',
  html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#172b3b"><p style="color:#3976d7;font-weight:700;letter-spacing:.08em">ROOMSYNC ACCOUNT SECURITY</p><h2>Verify your email</h2><p>Hi ' + escapeHtml(name) + ',</p><p>Enter this code to finish creating your RoomSync account:</p><div style="margin:24px 0;padding:18px;background:#edf4fb;border-radius:12px;text-align:center;font-size:32px;font-weight:800;letter-spacing:10px;color:#205cc9">' + otp + '</div><p>This code expires in 10 minutes and can only be used once.</p><p>If you did not start this registration, you can safely ignore this email.</p></div>'
});

exports.requestOtp = async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const phone = String(req.body.phone || '').trim() || null;

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
  if (!process.env.PASSWORD_RESET_OTP_SECRET) {
    return res.status(503).json({ message: 'Email verification is not configured. Set PASSWORD_RESET_OTP_SECRET in backend/.env and restart the backend.' });
  }

  const emailStatus = getEmailProviderStatus();
  const emailProvider = getEmailProvider();
  if (!emailStatus.configured) {
    const hint = emailProvider === 'gmail'
      ? 'Set SMTP_USER and SMTP_APP_PASSWORD in backend/.env.'
      : emailProvider === 'resend'
        ? 'Set RESEND_API_KEY and RESEND_FROM_EMAIL in backend/.env.'
        : 'Set EMAIL_PROVIDER to gmail or resend.';
    return res.status(503).json({ message: 'Registration email delivery is not configured. ' + hint });
  }

  const requestIp = String(req.ip || req.socket?.remoteAddress || '').slice(0, 45) || null;
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const passwordHash = await bcrypt.hash(password, 12);
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const otpHash = createRegistrationOtpHash(email, otp);
  let connection = null;
  let otpRecordId = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query(
      "DELETE FROM registration_otps WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day' OR (used_at IS NOT NULL AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day')"
    );

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'An account with this email already exists. Sign in or use password reset instead.' });
    }

    const [ipRate] = await connection.query(
      'SELECT COUNT(*) AS request_count FROM registration_otps WHERE request_ip = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'',
      [requestIp]
    );
    if (requestIp && Number(ipRate[0]?.request_count || 0) >= 10) {
      await connection.rollback();
      return res.status(429).json({ message: 'Too many verification requests from this device. Wait 10 minutes before trying again.' });
    }

    const [recent] = await connection.query(
      'SELECT id FROM registration_otps WHERE email = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds' ORDER BY id DESC LIMIT 1',
      [email]
    );
    if (recent.length) {
      await connection.rollback();
      return res.status(429).json({ message: 'A verification code was sent recently. Wait 60 seconds before requesting another one.' });
    }

    await connection.query(
      'UPDATE registration_otps SET used_at = CURRENT_TIMESTAMP WHERE email = ? AND used_at IS NULL',
      [email]
    );

    const [inserted] = await connection.query(
      'INSERT INTO registration_otps (email, name, phone, password_hash, otp_hash, request_ip, expires_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '10 minutes')',
      [email, name, phone, passwordHash, otpHash, requestIp]
    );
    otpRecordId = inserted.insertId;
    await connection.commit();
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error('Registration OTP rollback failed:', rollbackError.code || rollbackError.message);
      }
    }
    console.error('Registration OTP request failed:', { code: error.code, errno: error.errno, message: error.message });
    if (error.code === 'ER_NO_SUCH_TABLE' || Number(error.errno) === 1146) {
      return res.status(503).json({ message: 'The registration verification table is missing from PostgreSQL. Check DB_SCHEMA and apply backend/schema.postgres.sql to a new database if it has not been initialized.' });
    }
    if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ETIMEDOUT'].includes(error.code)) {
      return res.status(503).json({ message: 'RoomSync cannot connect to PostgreSQL. Check DATABASE_URL and DB_SCHEMA in the backend environment.' });
    }
    return res.status(500).json({
      message: isDevelopment
        ? 'Could not start email verification (' + (error.code || 'database error') + '). Check the backend terminal.'
        : 'We could not start email verification. Please try again.'
    });
  } finally {
    if (connection) connection.release();
  }

  try {
    const message = buildRegistrationEmail({ name, otp });
    await sendEmail({
      to: email,
      ...message,
      idempotencyKey: 'roomsync-registration-' + otpRecordId
    });
  } catch (error) {
    try {
      await pool.query('UPDATE registration_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL', [otpRecordId]);
    } catch (invalidateError) {
      console.error('Could not invalidate undelivered registration code:', invalidateError.code || invalidateError.message);
    }
    console.error('Registration OTP email delivery failed:', { code: error.status || error.code, message: error.message });
    const providerHint = emailProvider === 'gmail'
      ? 'Check SMTP_USER, the 16-character Google App Password in SMTP_APP_PASSWORD, and network access to smtp.gmail.com.'
      : 'Check RESEND_API_KEY, RESEND_FROM_EMAIL and your verified sender domain.';
    return res.status(503).json({
      message: isDevelopment
        ? 'RoomSync could not send the verification email: ' + error.message + '. ' + providerHint
        : 'Email delivery is temporarily unavailable. Please try again later.'
    });
  }

  return res.status(200).json({
    message: 'Verification code sent. Check your inbox and spam folder.',
    expires_in_seconds: 600,
    resend_after_seconds: 60
  });
};

exports.verifyOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (!isValidOtp(otp)) {
    return res.status(400).json({ message: 'Enter the six-digit verification code.' });
  }
  if (!process.env.PASSWORD_RESET_OTP_SECRET) {
    return res.status(503).json({ message: 'Email verification is not configured on this server.' });
  }

  let connection = null;
  let user = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [records] = await connection.query(
      'SELECT id, email, name, phone, password_hash, otp_hash, attempts FROM registration_otps WHERE email = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [email]
    );
    if (!records.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'The verification code is invalid or expired. Request a new code and try again.' });
    }

    const record = records[0];
    if (Number(record.attempts) >= 5) {
      await connection.query('UPDATE registration_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
      await connection.commit();
      return res.status(400).json({ message: 'Too many incorrect attempts. Request a new verification code.' });
    }

    const submittedHash = createRegistrationOtpHash(email, otp);
    const matches = safeCompareHex(submittedHash, record.otp_hash);
    if (!matches) {
      const nextAttempts = Number(record.attempts) + 1;
      await connection.query(
        'UPDATE registration_otps SET attempts = ?, used_at = CASE WHEN ? >= 5 THEN CURRENT_TIMESTAMP ELSE used_at END WHERE id = ?',
        [nextAttempts, nextAttempts, record.id]
      );
      await connection.commit();
      return res.status(400).json({
        message: nextAttempts >= 5
          ? 'Too many incorrect attempts. Request a new verification code.'
          : 'That code is incorrect. Check the email and try again.'
      });
    }

    const [existing] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE', [email]);
    if (existing.length) {
      await connection.query('UPDATE registration_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
      await connection.commit();
      return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    }

    const username = await getUniqueUsername(connection, record.name);
    const [created] = await connection.query(
      'INSERT INTO users (name, username, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
      [record.name, username, record.email, record.phone, record.password_hash, 'student']
    );
    await connection.query('UPDATE registration_otps SET used_at = CURRENT_TIMESTAMP WHERE email = ? AND used_at IS NULL', [email]);
    await connection.commit();

    user = {
      id: created.insertId,
      name: record.name,
      username,
      email: record.email,
      phone: record.phone || null,
      role: 'student'
    };
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error('Registration verification rollback failed:', rollbackError.code || rollbackError.message);
      }
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this email or generated username already exists. Sign in or request a new registration code.' });
    }
    console.error('Registration OTP verification failed:', { code: error.code, errno: error.errno, message: error.message });
    if (error.code === 'ER_NO_SUCH_TABLE' || Number(error.errno) === 1146) {
      return res.status(503).json({ message: 'The registration verification table is missing. Run backend/migrations/2026-11-09-registration-otp.sql, then restart the backend.' });
    }
    return res.status(500).json({
      message: process.env.NODE_ENV !== 'production'
        ? 'Email verification failed (' + (error.code || 'database error') + '). Check the backend terminal.'
        : 'We could not verify your email. Please try again.'
    });
  } finally {
    if (connection) connection.release();
  }

  try {
    await recordActivity({ actorUserId: user.id, subjectUserId: user.id, eventType: 'user_registered', entityType: 'user', entityId: user.id });
  } catch (activityError) {
    console.error('Registration activity logging failed:', activityError);
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return res.status(201).json({ token, user });
};
