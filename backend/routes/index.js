const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/profiles', require('./profileRoutes'));
router.use('/rooms', require('./roomRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
