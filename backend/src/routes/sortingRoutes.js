const express = require('express');
const router = express.Router();
const {
  getDestinationGroups,
  processNextFromQueue,
  processAllFromQueue
} = require('../controllers/sortingController');
const { authenticateToken } = require('../middleware/auth');

router.get('/groups', authenticateToken, getDestinationGroups);
router.post('/process-next', authenticateToken, processNextFromQueue);
router.post('/process-all', authenticateToken, processAllFromQueue);

module.exports = router;

