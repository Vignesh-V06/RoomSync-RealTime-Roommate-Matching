const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEmail,
  createRegistrationOtpHash,
  safeCompareHex,
  isValidOtp
} = require('../utils/registrationOtp');

test('registration OTP email normalization is case-insensitive', () => {
  assert.equal(normalizeEmail('  Student@Example.COM '), 'student@example.com');
});

test('registration OTP hashes are deterministic for the same email, code and secret', () => {
  const first = createRegistrationOtpHash('student@example.com', '123456', 'test-secret');
  const second = createRegistrationOtpHash('STUDENT@example.com', '123456', 'test-secret');
  assert.equal(first, second);
});

test('registration OTP hash is bound to the email address and secret', () => {
  const original = createRegistrationOtpHash('student@example.com', '123456', 'test-secret');
  assert.notEqual(original, createRegistrationOtpHash('other@example.com', '123456', 'test-secret'));
  assert.notEqual(original, createRegistrationOtpHash('student@example.com', '123456', 'another-secret'));
});

test('registration OTP comparison accepts only the matching well-formed hash', () => {
  const hash = createRegistrationOtpHash('student@example.com', '123456', 'test-secret');
  assert.equal(safeCompareHex(hash, hash), true);
  assert.equal(safeCompareHex(createRegistrationOtpHash('student@example.com', '654321', 'test-secret'), hash), false);
  assert.equal(safeCompareHex('not-a-hash', hash), false);
});

test('registration OTP validation requires exactly six digits', () => {
  assert.equal(isValidOtp('123456'), true);
  assert.equal(isValidOtp('012345'), true);
  assert.equal(isValidOtp('12345'), false);
  assert.equal(isValidOtp('1234567'), false);
  assert.equal(isValidOtp('12a456'), false);
});

const authController = require('../controllers/authController');

test('legacy direct registration endpoint cannot create an account without OTP', async () => {
  let statusCode = 200;
  let responseBody = null;
  const response = {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; return this; }
  };

  await authController.register({ body: {} }, response);
  assert.equal(statusCode, 410);
  assert.match(responseBody.message, /verify your email OTP/i);
});
