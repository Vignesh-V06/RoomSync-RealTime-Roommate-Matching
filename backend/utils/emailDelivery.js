const nodemailer = require('nodemailer');

const getEmailProvider = () => {
  const configured = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  return configured || (process.env.NODE_ENV === 'production' ? 'resend' : 'gmail');
};

const getEmailProviderStatus = () => {
  const provider = getEmailProvider();
  const gmailUserConfigured = Boolean(process.env.SMTP_USER);
  const gmailAppPasswordConfigured = Boolean(process.env.SMTP_APP_PASSWORD);
  const resendApiKeyConfigured = Boolean(process.env.RESEND_API_KEY);
  const resendSenderConfigured = Boolean(process.env.RESEND_FROM_EMAIL);

  return {
    provider,
    configured: provider === 'gmail'
      ? gmailUserConfigured && gmailAppPasswordConfigured
      : provider === 'resend'
        ? resendApiKeyConfigured && resendSenderConfigured
        : false,
    gmailUserConfigured,
    gmailAppPasswordConfigured,
    resendApiKeyConfigured,
    resendSenderConfigured
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
      pass: String(process.env.SMTP_APP_PASSWORD || '').replace(/\\s+/g, '')
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { minVersion: 'TLSv1.2' }
  });
};

const sendEmail = async ({ to, subject, text, html, idempotencyKey }) => {
  const provider = getEmailProvider();

  if (provider === 'gmail') {
    const transporter = createGmailTransporter();
    try {
      const from = process.env.SMTP_FROM_EMAIL || 'RoomSync <' + process.env.SMTP_USER + '>';
      await transporter.sendMail({ from, to, subject, text, html });
    } finally {
      transporter.close();
    }
    return;
  }

  if (provider === 'resend') {
    const headers = {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'RoomSync/1.0'
    };
    if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 240);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [to],
        subject,
        text,
        html
      }),
      signal: AbortSignal.timeout(10000)
    });
    const responseText = await response.text();
    let result = {};
    try { result = responseText ? JSON.parse(responseText) : {}; } catch { result = {}; }
    if (!response.ok) throw new Error(result.message || 'The Resend email provider rejected the message.');
    return;
  }

  throw new Error('Unsupported EMAIL_PROVIDER. Choose gmail or resend.');
};

module.exports = { getEmailProvider, getEmailProviderStatus, sendEmail };
