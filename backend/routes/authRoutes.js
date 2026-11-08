const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passwordResetController = require('../controllers/passwordResetController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/password-reset/diagnostics', passwordResetController.getLocalDiagnostics);
router.post('/password-reset/request-otp', passwordResetController.requestOtp);
router.post('/password-reset/verify-otp', passwordResetController.verifyOtpAndReset);

module.exports = router;
