const express = require('express');
const router = express.Router();
const { getQueueStatus, enqueueManually, dequeueNext } = require('../controllers/queueController');
const { authenticateToken } = require('../middleware/auth');

router.get('/status', authenticateToken, getQueueStatus);
router.post('/enqueue', authenticateToken, enqueueManually);
router.post('/dequeue', authenticateToken, dequeueNext);

module.exports = router;

