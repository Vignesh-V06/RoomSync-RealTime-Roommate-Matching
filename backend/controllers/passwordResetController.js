const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const pool = require('../db/config');
const recordActivity = require('../utils/activityLogger');

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

const getEmailProvider = () => {
  const configured = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? 'resend' : 'gmail';
};

const getEmailProviderStatus = () => {
  const provider = getEmailProvider();
  const gmailUserConfigured = Boolean(process.env.SMTP_USER);
  const gmailAppPasswordConfigured = Boolean(process.env.SMTP_APP_PASSWORD);
  const resendApiKeyConfigured = Boolean(process.env.RESEND_API_KEY);
  const resendSenderConfigured = Boolean(process.env.RESEND_FROM_EMAIL);
  const gmailReady = gmailUserConfigured && gmailAppPasswordConfigured;
  const resendReady = resendApiKeyConfigured && resendSenderConfigured;

  return {
    provider,
    configured: provider === 'gmail'
      ? gmailReady
      : provider === 'resend'
        ? resendReady
        : false,
    gmailUserConfigured,
    gmailAppPasswordConfigured,
    resendApiKeyConfigured,
    resendSenderConfigured,
    senderAddressConfigured: provider === 'gmail'
      ? gmailUserConfigured
      : provider === 'resend'
        ? resendSenderConfigured
        : false
  };
};

const createGmailTransporter = () => {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_APP_PASSWORD || '').replace(/\s+/g, '')
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { minVersion: 'TLSv1.2' }
  });
};

const buildOtpEmail = ({ to, name, otp, from }) => ({
  from,
  to,
  subject: 'Your RoomSync password reset code',
  text: 'Hi ' + name + ', your RoomSync verification code is ' + otp + '. It expires in 10 minutes and can only be used once. If you did not request this, ignore this email.',
  html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;color:#172b3b"><p style="color:#3976d7;font-weight:700;letter-spacing:.08em">ROOMSYNC SECURITY</p><h2>Password reset code</h2><p>Hi ' + escapeHtml(name) + ',</p><p>Use this code to reset your RoomSync password:</p><div style="margin:24px 0;padding:18px;background:#edf4fb;border-radius:12px;text-align:center;font-size:32px;font-weight:800;letter-spacing:10px;color:#205cc9">' + otp + '</div><p>This code expires in 10 minutes and can only be used once.</p><p>If you did not request this change, you can safely ignore this email.</p></div>'
});

const sendOtpEmail = async ({ to, name, otp, recordId }) => {
  const provider = getEmailProvider();

  if (provider === 'gmail') {
    const transporter = createGmailTransporter();
    try {
      const from = process.env.SMTP_FROM_EMAIL || 'RoomSync <' + process.env.SMTP_USER + '>';
      await transporter.sendMail(buildOtpEmail({ to, name, otp, from }));
    } finally {
      transporter.close();
    }
    return;
  }

  if (provider === 'resend') {
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
        ...buildOtpEmail({ to, name, otp, from: process.env.RESEND_FROM_EMAIL })
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
      throw new Error(result.message || 'The Resend email provider rejected the password reset message.');
    }
    return;
  }

  throw new Error('Unsupported EMAIL_PROVIDER. Choose gmail or resend.');
};

exports.requestOtp = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const emailStatus = getEmailProviderStatus();
  const emailProvider = emailStatus.provider;
  if (!emailStatus.configured || !process.env.PASSWORD_RESET_OTP_SECRET) {
    const providerHint = emailProvider === 'gmail'
      ? 'Set SMTP_USER and SMTP_APP_PASSWORD (a Google App Password) in backend/.env.'
      : emailProvider === 'resend'
        ? 'Set RESEND_API_KEY and RESEND_FROM_EMAIL in backend/.env.'
        : 'Set EMAIL_PROVIDER to gmail or resend.';
    return res.status(503).json({
      message: 'Password reset email is not configured. ' + providerHint + ' Also set PASSWORD_RESET_OTP_SECRET and restart the backend.'
    });
  }

  const requestIp = String(req.ip || req.socket?.remoteAddress || '').slice(0, 45) || null;
  let connection = null;
  let user = null;
  let otp = null;
  let otpRecordId = null;

  try {
    // Acquire the connection inside the try block so refused PostgreSQL connections
    // return a useful API response instead of falling through Express.
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query(
      'SELECT id, name, email FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
      [email]
    );

    if (!users.length) {
      await connection.commit();
      if (isDevelopment) {
        return res.status(404).json({
          message: 'No RoomSync account uses this email address. Register a test account with an inbox you can access, then request the code again.'
        });
      }
      // Keep production responses generic to avoid account enumeration.
      return res.json({ message: GENERIC_REQUEST_MESSAGE });
    }

    user = users[0];

    const [ipRate] = await connection.query(
      'SELECT COUNT(*) AS request_count FROM password_reset_otps WHERE request_ip = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'',
      [requestIp]
    );
    if (requestIp && Number(ipRate[0]?.request_count || 0) >= 10) {
      await connection.commit();
      if (isDevelopment) {
        return res.status(429).json({ message: 'Too many reset requests from this device. Wait 10 minutes before trying again.' });
      }
      return res.json({ message: GENERIC_REQUEST_MESSAGE });
    }

    const [recent] = await connection.query(
      'SELECT id FROM password_reset_otps WHERE user_id = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds' ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    if (recent.length) {
      await connection.commit();
      if (isDevelopment) {
        return res.status(429).json({ message: 'A code was requested recently. Wait 60 seconds before requesting another one.' });
      }
      return res.json({ message: GENERIC_REQUEST_MESSAGE });
    }

    otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const otpHash = createOtpHash(user.id, otp);

    await connection.query(
      'UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    const [inserted] = await connection.query(
      'INSERT INTO password_reset_otps (user_id, otp_hash, request_ip, expires_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '10 minutes')',
      [user.id, otpHash, requestIp]
    );
    otpRecordId = inserted.insertId;
    await connection.commit();
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error('Password reset transaction rollback failed:', rollbackError.code || rollbackError.message);
      }
    }
    console.error('Password reset OTP request could not be prepared:', {
      code: error.code,
      errno: error.errno,
      message: error.message
    });

    if (error.code === 'ER_NO_SUCH_TABLE' || Number(error.errno) === 1146) {
      return res.status(503).json({
        message: 'The password reset table is missing. Run backend/migrations/2026-11-08-password-reset-otp.sql against the roomsync database, then restart the backend.'
      });
    }
    if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ETIMEDOUT'].includes(error.code)) {
      return res.status(503).json({
        message: 'RoomSync cannot connect to PostgreSQL. Check DATABASE_URL and DB_SCHEMA in the backend environment.'
      });
    }
    return res.status(500).json({
      message: isDevelopment
        ? 'The password reset request failed in PostgreSQL (' + (error.code || 'unknown database error') + '). Check the backend terminal for the SQL error.'
        : 'We could not start password reset. Please try again.'
    });
  } finally {
    if (connection) connection.release();
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
      console.error('Could not invalidate undelivered password reset code:', invalidateError.code || invalidateError.message);
    }

    console.error('Password reset email delivery failed:', {
      code: error.status || error.code,
      message: error.message
    });

    if (isDevelopment) {
      const providerMessage = emailProvider === 'gmail'
        ? 'Gmail SMTP could not deliver the OTP email: '
        : 'Resend could not deliver the OTP email: ';
      const providerHint = emailProvider === 'gmail'
        ? 'Check SMTP_USER, the 16-character Google App Password in SMTP_APP_PASSWORD, and that 2-Step Verification is enabled.'
        : 'Check RESEND_API_KEY, RESEND_FROM_EMAIL and the verified-domain restriction.';
      return res.status(503).json({
        message: providerMessage + error.message + '. ' + providerHint
      });
    }

    // Production stays generic so responses do not reveal whether an account exists.
    return res.status(503).json({
      message: 'Email delivery is temporarily unavailable. Please try again later.'
    });
  }

  return res.json({ message: 'Verification code sent if this email belongs to a RoomSync account. Check your inbox and spam folder.' });
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

  let connection = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [records] = await connection.query(
      'SELECT pr.id, pr.user_id, pr.otp_hash, pr.attempts FROM password_reset_otps pr JOIN users u ON u.id = pr.user_id WHERE u.email = ? AND pr.used_at IS NULL AND pr.expires_at > CURRENT_TIMESTAMP ORDER BY pr.id DESC LIMIT 1 FOR UPDATE',
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
        'UPDATE password_reset_otps SET attempts = ?, used_at = CASE WHEN ? >= 5 THEN CURRENT_TIMESTAMP ELSE used_at END WHERE id = ?',
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
    await recordActivity({ actorUserId: record.user_id, subjectUserId: record.user_id, eventType: 'password_reset_completed', entityType: 'user', entityId: record.user_id });

    return res.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error('Password reset verification rollback failed:', rollbackError.code || rollbackError.message);
      }
    }
    console.error('Password reset verification failed:', { code: error.code, errno: error.errno, message: error.message });
    if (error.code === 'ER_NO_SUCH_TABLE' || Number(error.errno) === 1146) {
      return res.status(503).json({ message: 'The password reset table is missing. Run backend/migrations/2026-11-08-password-reset-otp.sql, then restart the backend.' });
    }
    return res.status(500).json({
      message: process.env.NODE_ENV !== 'production'
        ? 'Password reset verification failed (' + (error.code || 'database error') + '). Check the backend terminal.'
        : 'We could not reset your password. Please try again.'
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.getLocalDiagnostics = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.sendStatus(404);
  }

  const emailStatus = getEmailProviderStatus();
  const diagnostics = {
    emailProvider: emailStatus.provider,
    emailProviderConfigured: emailStatus.configured,
    gmailSmtpUserConfigured: emailStatus.gmailUserConfigured,
    gmailAppPasswordConfigured: emailStatus.gmailAppPasswordConfigured,
    resendApiKeyConfigured: emailStatus.resendApiKeyConfigured,
    resendSenderConfigured: emailStatus.resendSenderConfigured,
    senderAddressConfigured: emailStatus.senderAddressConfigured,
    smtpConnectionVerified: null,
    otpSecretConfigured: Boolean(process.env.PASSWORD_RESET_OTP_SECRET),
    postgresConnected: false,
    databaseConnected: false,
    otpTableExists: false,
    otpColumnsReady: false,
    missingOtpColumns: []
  };

  try {
    await pool.query('SELECT 1 AS connected');
    diagnostics.postgresConnected = true;
    diagnostics.databaseConnected = true;
  } catch (error) {
    diagnostics.databaseErrorCode = error.postgresCode || error.code || 'UNKNOWN';
  }

  if (diagnostics.postgresConnected) {
    try {
      const [columns] = await pool.query('SHOW COLUMNS FROM password_reset_otps');
      diagnostics.otpTableExists = true;
      const existing = new Set(columns.map((column) => column.Field));
      const required = ['user_id', 'otp_hash', 'request_ip', 'attempts', 'expires_at', 'used_at', 'created_at'];
      diagnostics.missingOtpColumns = required.filter((column) => !existing.has(column));
      diagnostics.otpColumnsReady = diagnostics.missingOtpColumns.length === 0;
    } catch (error) {
      diagnostics.otpTableErrorCode = error.code || 'UNKNOWN';
    }
  }

  if (emailStatus.provider === 'gmail' && emailStatus.configured) {
    const transporter = createGmailTransporter();
    try {
      await transporter.verify();
      diagnostics.smtpConnectionVerified = true;
    } catch (error) {
      diagnostics.smtpConnectionVerified = false;
      diagnostics.smtpErrorCode = error.code || error.responseCode || 'SMTP_VERIFY_FAILED';
    } finally {
      transporter.close();
    }
  }

  const notes = [];
  if (emailStatus.provider === 'gmail') {
    notes.push('Gmail SMTP sends from SMTP_USER. SMTP uses smtp.gmail.com on port 587 with STARTTLS by default.');
    if (!emailStatus.gmailUserConfigured || !emailStatus.gmailAppPasswordConfigured) {
      notes.push('Enable 2-Step Verification in the Google Account, create an App Password, and store it as SMTP_APP_PASSWORD. The regular Google password will not work.');
    } else if (diagnostics.smtpConnectionVerified === true) {
      notes.push('Gmail SMTP connection and authentication verified. A test message has not been sent by this check.');
    } else if (diagnostics.smtpConnectionVerified === false) {
      notes.push('Gmail SMTP verification failed. Check the App Password, Google account eligibility, and network access to smtp.gmail.com.');
    }
  } else if (emailStatus.provider === 'resend') {
    if (!emailStatus.resendApiKeyConfigured || !emailStatus.resendSenderConfigured) {
      notes.push('Configure RESEND_API_KEY and RESEND_FROM_EMAIL to use Resend.');
    } else {
      notes.push('Resend is selected. Confirm that the sender domain is verified in your Resend account.');
    }
  } else {
    notes.push('Unsupported EMAIL_PROVIDER. Set it to gmail or resend.');
  }

  res.set('Cache-Control', 'no-store');
  res.json({ ...diagnostics, notes });
};
