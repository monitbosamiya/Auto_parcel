const express = require('express');
const router = express.Router();
const { registerParcel, validateParcel, getRegisteredParcels } = require('../controllers/parcelController');
const { authenticateToken } = require('../middleware/auth');

// Protected routes (Single Operator Admin)
router.post('/validate', authenticateToken, validateParcel);
router.post('/register', authenticateToken, registerParcel);
router.get('/', authenticateToken, getRegisteredParcels);

module.exports = router;

