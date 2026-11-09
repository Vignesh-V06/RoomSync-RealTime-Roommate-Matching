const crypto = require('crypto');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const createRegistrationOtpHash = (email, otp, secret = process.env.PASSWORD_RESET_OTP_SECRET) => {
  if (!secret) throw new Error('OTP secret is not configured.');
  return crypto.createHmac('sha256', secret)
    .update(normalizeEmail(email) + ':' + String(otp))
    .digest('hex');
};

const safeCompareHex = (submittedHex, storedHex) => {
  if (!/^[a-f0-9]{64}$/i.test(String(submittedHex || ''))) return false;
  if (!/^[a-f0-9]{64}$/i.test(String(storedHex || ''))) return false;
  const submitted = Buffer.from(submittedHex, 'hex');
  const stored = Buffer.from(storedHex, 'hex');
  return submitted.length === stored.length && crypto.timingSafeEqual(submitted, stored);
};

const isValidOtp = (value) => /^\d{6}$/.test(String(value || '').trim());

module.exports = { normalizeEmail, createRegistrationOtpHash, safeCompareHex, isValidOtp };
