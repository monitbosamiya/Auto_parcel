const express = require('express');
const router = express.Router();
const {
  listDueBatches,
  processDispatch,
  listDispatches
} = require('../controllers/dispatchController');
const { authenticateToken } = require('../middleware/auth');

// Protected routes (Admin Operator)
router.get('/due', authenticateToken, listDueBatches);
router.post('/process', authenticateToken, processDispatch);
router.get('/history', authenticateToken, listDispatches);

module.exports = router;

