const express = require('express');
const router = express.Router();
const { trackParcel } = require('../controllers/trackingController');
const { authenticateToken } = require('../middleware/auth');

// Tracking can be accessed by operator or tracking query
router.get('/:tracking_id', authenticateToken, trackParcel);
router.post('/lookup', authenticateToken, trackParcel);

module.exports = router;

