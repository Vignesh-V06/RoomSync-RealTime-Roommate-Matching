const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const requestController = require('../controllers/requestController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, roomController.createRoom);
router.get('/vacant/:userId', authMiddleware, roomController.getVacantRooms);
router.get('/my-groups', authMiddleware, roomController.getMyGroups);
router.get('/my-applications', authMiddleware, roomController.getMyApplications);
router.get('/owner/analytics', authMiddleware, roomController.getOwnerAnalytics);
router.get('/:roomId/members', authMiddleware, roomController.getOwnerRoomMembers);
router.get('/:roomId/preview', authMiddleware, roomController.getRoomPreview);
router.get('/requests/:ownerId', authMiddleware, requestController.getOwnerRequests);
router.post('/apply', authMiddleware, requestController.applyRoom);
router.post('/requests/accept', authMiddleware, requestController.acceptRequest);
router.post('/requests/reject', authMiddleware, requestController.rejectRequest);
router.post('/requests/remove', authMiddleware, requestController.removeRoommate);

router.get('/:roomId/details', authMiddleware, roomController.getRoomDetails);
router.post('/:roomId/images', authMiddleware, roomController.uploadRoomImage);
router.get('/:roomId/images/:imageId', roomController.getRoomImage);
router.patch('/:roomId/status', authMiddleware, roomController.setRoomStatus);
router.patch('/:roomId/room-number', authMiddleware, roomController.updateRoomNumber);
router.delete('/:roomId', authMiddleware, roomController.deleteRoom);

module.exports = router;
