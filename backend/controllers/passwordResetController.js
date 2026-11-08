const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../db/config');

const GENERIC_REQUEST_MESSAGE = 'If an account exists for that email, a verification code will be sent shortly.';
const INVALID_CODE_MESSAGE = 'The verification code is invalid or has expired. Request a new code and try again.';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const createOtpHash = (userId, otp) => crypto
  .createHmac('sha256', process.env.PASSWORD_RESET_OTP_SECRET)
  .update(String(userId) + ':' + String(otp))
  .digest('hex');

const sendOtpEmail = async ({ to, name, otp, recordId }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'roomsync-password-reset-' + recordId,
      'User-Agent': 'RoomSync/1.0'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject: 'Your RoomSync password reset code',
      text: 'Hi ' + name + ', your RoomSync verification code is ' + otp + '. It expires in 10 minutes and can only be used once. If you did not request this, ignore this email.',
      html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#172b3b"><p style="color:#3976d7;font-weight:700;letter-spacing:.08em">ROOMSYNC SECURITY</p><h2>Password reset code</h2><p>Hi ' + escapeHtml(name) + ',</p><p>Use this code to reset your RoomSync password:</p><div style="margin:24px 0;padding:18px;background:#edf4fb;border-radius:12px;text-align:center;font-size:32px;font-weight:800;letter-spacing:10px;color:#205cc9">' + otp + '</div><p>This code expires in 10 minutes and can only be used once.</p><p>If you did not request this change, you can safely ignore this email.</p></div>'
    }),
    signal: AbortSignal.timeout(10000)
  });

  const responseText = await response.text();
  let result = {};
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    result = {};
  }
  if (!response.ok) {
    throw new Error(result.message || 'The email provider rejected the password reset message.');
  }
};

exports.requestOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  if (
    !process.env.RESEND_API_KEY
    || !process.env.RESEND_FROM_EMAIL
    || !process.env.PASSWORD_RESET_OTP_SECRET
  ) {
    return res.status(503).json({
      message: 'Password reset email is not configured on this server yet.'
    });
  }

  const requestIp = String(req.ip || req.socket?.remoteAddress || '').slice(0, 45) || null;
  const connection = await pool.getConnection();
  let user = null;
  let otp = null;
  let otpRecordId = null;

  try {
    await connection.beginTransaction();
    const [users] = await connection.query(
      'SELECT id, name, email FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [email]
    );

    if (!users.length) {
      await connection.commit();
      return res.json({ message: GENERIC_REQUEST_MESSAGE });
    }

    user = users[0];

    const [ipRate] = await connection.query(
      'SELECT COUNT(*) AS request_count FROM password_reset_otps WHERE request_ip = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)',
      [requestIp]
    );
    if (requestIp && Number(ipRate[0]?.request_count || 0) >= 10) {
      await connection.commit();
      return res.json({ message: GENERIC_REQUEST_MESSAGE });
    }

    const [recent] = await connection.query(
      'SELECT id FROM password_reset_otps WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND) ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    if (recent.length) {
      await connection.commit();
      return res.json({ message: GENERIC_REQUEST_MESSAGE });
    }

    otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const otpHash = createOtpHash(user.id, otp);

    await connection.query(
      'UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    const [inserted] = await connection.query(
      'INSERT INTO password_reset_otps (user_id, otp_hash, request_ip, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [user.id, otpHash, requestIp]
    );
    otpRecordId = inserted.insertId;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Password reset OTP request could not be prepared:', error);
    return res.status(500).json({ message: 'We could not start password reset. Please try again.' });
  } finally {
    connection.release();
  }

  try {
    await sendOtpEmail({
      to: user.email,
      name: user.name || 'RoomSync member',
      otp,
      recordId: otpRecordId
    });
  } catch (error) {
    try {
      await pool.query(
        'UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL',
        [otpRecordId]
      );
    } catch (invalidateError) {
      console.error('Could not invalidate undelivered password reset code:', invalidateError);
    }
    console.error('Password reset email delivery failed:', error.message);
    // Keep the response generic so it does not reveal whether the email is registered.
  }

  return res.json({ message: GENERIC_REQUEST_MESSAGE });
};

exports.verifyOtpAndReset = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const newPassword = String(req.body.newPassword || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: INVALID_CODE_MESSAGE });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ message: 'Password must contain 8 to 128 characters.' });
  }
  if (!process.env.PASSWORD_RESET_OTP_SECRET) {
    return res.status(503).json({ message: 'Password reset is not configured on this server yet.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [records] = await connection.query(
      'SELECT pr.id, pr.user_id, pr.otp_hash, pr.attempts FROM password_reset_otps pr JOIN users u ON u.id = pr.user_id WHERE u.email = ? AND pr.used_at IS NULL AND pr.expires_at > NOW() ORDER BY pr.id DESC LIMIT 1 FOR UPDATE',
      [email]
    );

    if (!records.length) {
      await connection.rollback();
      return res.status(400).json({ message: INVALID_CODE_MESSAGE });
    }

    const record = records[0];
    if (Number(record.attempts) >= 5) {
      await connection.query(
        'UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [record.id]
      );
      await connection.commit();
      return res.status(400).json({ message: INVALID_CODE_MESSAGE });
    }

    const submittedHash = Buffer.from(createOtpHash(record.user_id, otp), 'hex');
    const storedHash = Buffer.from(record.otp_hash, 'hex');
    const matches = submittedHash.length === storedHash.length
      && crypto.timingSafeEqual(submittedHash, storedHash);

    if (!matches) {
      const nextAttempts = Number(record.attempts) + 1;
      await connection.query(
        'UPDATE password_reset_otps SET attempts = ?, used_at = IF(? >= 5, CURRENT_TIMESTAMP, used_at) WHERE id = ?',
        [nextAttempts, nextAttempts, record.id]
      );
      await connection.commit();
      return res.status(400).json({ message: INVALID_CODE_MESSAGE });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await connection.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [passwordHash, record.user_id]
    );
    await connection.query(
      'UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
      [record.user_id]
    );
    await connection.commit();

    return res.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (error) {
    await connection.rollback();
    console.error('Password reset verification failed:', error);
    return res.status(500).json({ message: 'We could not reset your password. Please try again.' });
  } finally {
    connection.release();
  }
};
