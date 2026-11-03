const express = require('express');
const router = express.Router();
const { evaluateSchedule } = require('../controllers/schedulingController');
const { authenticateToken } = require('../middleware/auth');

// Protected endpoint to evaluate parcel allocation for a departure
router.post('/evaluate', authenticateToken, evaluateSchedule);

module.exports = router;

