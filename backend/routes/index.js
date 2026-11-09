const express = require('express');
const router = express.Router();

const API_VERSION = 'roomsync-owner-room-management-2';

router.get('/health', (req, res) => {
  res.json({
    service: 'RoomSync API',
    status: 'ok',
    apiVersion: API_VERSION,
    features: ['owner-room-number-update', 'owner-roommate-management']
  });
});

router.use('/auth', require('./authRoutes'));
router.use('/profiles', require('./profileRoutes'));
router.use('/rooms', require('./roomRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
