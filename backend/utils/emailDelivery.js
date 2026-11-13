const nodemailer = require('nodemailer');

const getEmailProvider = () => {
  const configured = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  return configured || (process.env.NODE_ENV === 'production' ? 'resend' : 'gmail');
};

const isValidAppsScriptUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:'
      && url.hostname === 'script.google.com'
      && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
  } catch {
    return false;
  }
};

const getEmailProviderStatus = () => {
  const provider = getEmailProvider();
  const gmailUserConfigured = Boolean(process.env.SMTP_USER);
  const gmailAppPasswordConfigured = Boolean(process.env.SMTP_APP_PASSWORD);
  const resendApiKeyConfigured = Boolean(process.env.RESEND_API_KEY);
  const resendSenderConfigured = Boolean(process.env.RESEND_FROM_EMAIL);
  const appsScriptUrlConfigured = isValidAppsScriptUrl(process.env.APPS_SCRIPT_EMAIL_URL);
  const appsScriptSecretConfigured = Boolean(process.env.APPS_SCRIPT_EMAIL_SECRET);

  return {
    provider,
    configured: provider === 'gmail'
      ? gmailUserConfigured && gmailAppPasswordConfigured
      : provider === 'resend'
        ? resendApiKeyConfigured && resendSenderConfigured
        : provider === 'apps_script'
          ? appsScriptUrlConfigured && appsScriptSecretConfigured
          : false,
    gmailUserConfigured,
    gmailAppPasswordConfigured,
    resendApiKeyConfigured,
    resendSenderConfigured,
    appsScriptUrlConfigured,
    appsScriptSecretConfigured,
    senderAddressConfigured: provider === 'gmail'
      ? gmailUserConfigured
      : provider === 'resend'
        ? resendSenderConfigured
        : provider === 'apps_script'
          ? appsScriptUrlConfigured && appsScriptSecretConfigured
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

const sendAppsScriptEmail = async ({ to, subject, text, html }) => {
  const url = String(process.env.APPS_SCRIPT_EMAIL_URL || '').trim();
  const secret = String(process.env.APPS_SCRIPT_EMAIL_SECRET || '');

  if (!isValidAppsScriptUrl(url)) {
    throw new Error('APPS_SCRIPT_EMAIL_URL must be the deployed Google Apps Script Web App URL ending in /exec.');
  }
  if (!secret) {
    throw new Error('APPS_SCRIPT_EMAIL_SECRET is not configured.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'RoomSync/1.0'
    },
    body: JSON.stringify({
      secret,
      to,
      subject,
      text: text || '',
      html: html || ''
    }),
    signal: AbortSignal.timeout(15000)
  });

  const responseText = await response.text();
  let result;
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error('Google Apps Script returned an unreadable response. Confirm the Web App deployment is active and accessible to anyone.');
  }

  if (!response.ok || result.ok !== true) {
    const knownErrors = {
      UNAUTHORIZED: 'Google Apps Script rejected the shared secret. Confirm APPS_SCRIPT_EMAIL_SECRET matches ROOMSYNC_MAIL_SECRET in Script Properties.',
      DAILY_EMAIL_QUOTA_EXCEEDED: 'The Gmail account has reached its daily email sending quota.',
      INVALID_RECIPIENT: 'Google Apps Script rejected the recipient email address.',
      INVALID_EMAIL_CONTENT: 'Google Apps Script rejected the email content.',
      EMPTY_REQUEST: 'Google Apps Script received an empty email request.',
      MAIL_DELIVERY_FAILED: 'Google Apps Script could not send the email. Check the Apps Script Executions log.'
    };
    throw new Error(knownErrors[String(result.error || '')] || 'Google Apps Script email delivery failed (HTTP ' + response.status + '). Check the deployment and Apps Script Executions log.');
  }
};

const sendEmail = async ({ to, subject, text, html, idempotencyKey }) => {
  const provider = getEmailProvider();

  if (provider === 'apps_script') {
    await sendAppsScriptEmail({ to, subject, text, html });
    return;
  }

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

  throw new Error('Unsupported EMAIL_PROVIDER. Choose apps_script, gmail or resend.');
};

module.exports = { getEmailProvider, getEmailProviderStatus, sendEmail };
