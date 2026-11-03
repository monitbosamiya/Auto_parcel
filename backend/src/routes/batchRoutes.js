const express = require('express');
const router = express.Router();
const {
  generateBatch,
  autoScheduleAndBatch,
  listBatches,
  getBatch
} = require('../controllers/batchController');
const { authenticateToken } = require('../middleware/auth');

// Protected routes (Admin Operator)
router.get('/', authenticateToken, listBatches);
router.get('/:id', authenticateToken, getBatch);
router.post('/generate', authenticateToken, generateBatch);
router.post('/auto-generate', authenticateToken, autoScheduleAndBatch);

module.exports = router;

