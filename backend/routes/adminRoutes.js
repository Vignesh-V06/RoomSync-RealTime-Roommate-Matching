const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

router.use(authMiddleware, adminMiddleware);
router.get('/analytics', adminController.getAnalytics);

module.exports = router;
