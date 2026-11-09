const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passwordResetController = require('../controllers/passwordResetController');
const registrationOtpController = require('../controllers/registrationOtpController');

router.post('/register', authController.register); // Deprecated: deliberately blocks OTP bypass.
router.post('/register/request-otp', registrationOtpController.requestOtp);
router.post('/register/verify-otp', registrationOtpController.verifyOtp);
router.post('/login', authController.login);
router.get('/password-reset/diagnostics', passwordResetController.getLocalDiagnostics);
router.post('/password-reset/request-otp', passwordResetController.requestOtp);
router.post('/password-reset/verify-otp', passwordResetController.verifyOtpAndReset);

module.exports = router;
