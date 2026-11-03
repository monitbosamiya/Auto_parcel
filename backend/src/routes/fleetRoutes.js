const express = require('express');
const router = express.Router();
const {
  getAllRoutes,
  createRoute,
  getAllTrucks,
  createTruck,
  updateTruckStatus,
  getAllSchedules,
  createSchedule,
  getUpcomingDepartures
} = require('../controllers/fleetController');
const { authenticateToken } = require('../middleware/auth');

// Protected admin endpoints
router.get('/routes', authenticateToken, getAllRoutes);
router.post('/routes', authenticateToken, createRoute);

router.get('/trucks', authenticateToken, getAllTrucks);
router.post('/trucks', authenticateToken, createTruck);
router.patch('/trucks/:id/status', authenticateToken, updateTruckStatus);

router.get('/schedules', authenticateToken, getAllSchedules);
router.post('/schedules', authenticateToken, createSchedule);

// Module 5 output to Module 6 Scheduling Engine
router.get('/upcoming-departures', authenticateToken, getUpcomingDepartures);

module.exports = router;

