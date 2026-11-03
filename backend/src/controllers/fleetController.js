const pool = require('../config/db');
const destinationSortingService = require('../services/sortingService');
const { getUpcomingDepartureCandidates } = require('../services/routeTruckService');

// ======================== ROUTES CRUD ========================
async function getAllRoutes(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, dg.group_name 
       FROM routes r 
       LEFT JOIN destination_groups dg ON r.route_id = dg.route_id 
       ORDER BY r.route_id ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function createRoute(req, res) {
  const { origin, destination, estimated_travel_hours, processing_buffer_hours = 0 } = req.body;

  if (!origin || !destination || !estimated_travel_hours) {
    return res.status(400).json({ success: false, message: 'Origin, destination, and travel hours are required' });
  }

  const travelHrs = parseFloat(estimated_travel_hours);
  const bufferHrs = parseFloat(processing_buffer_hours);

  if (travelHrs <= 0 || bufferHrs < 0) {
    return res.status(400).json({ success: false, message: 'Travel hours must be > 0 and buffer hours >= 0' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO routes (origin, destination, estimated_travel_hours, processing_buffer_hours)
       VALUES (?, ?, ?, ?)`,
      [origin.trim(), destination.trim(), travelHrs, bufferHrs]
    );

    const routeId = result.insertId;
    const groupName = `${origin.trim()} -> ${destination.trim()} Group`;

    await connection.query(
      `INSERT INTO destination_groups (route_id, group_name) VALUES (?, ?)`,
      [routeId, groupName]
    );

    await connection.commit();

    // Register into in-memory linked list groups
    destinationSortingService.ensureGroupExists(routeId, groupName);

    return res.status(201).json({
      success: true,
      message: 'Route created successfully',
      data: { route_id: routeId, origin, destination, estimated_travel_hours: travelHrs, processing_buffer_hours: bufferHrs }
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
}

// ======================== TRUCKS CRUD ========================
async function getAllTrucks(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, r.origin, r.destination 
       FROM trucks t 
       JOIN routes r ON t.route_id = r.route_id 
       ORDER BY t.truck_id ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function createTruck(req, res) {
  const { truck_number, route_id, capacity, availability_status = 'Available' } = req.body;

  if (!truck_number || !route_id || !capacity) {
    return res.status(400).json({ success: false, message: 'Truck number, route_id, and capacity are required' });
  }

  const numCapacity = parseFloat(capacity);
  if (numCapacity <= 0) {
    return res.status(400).json({ success: false, message: 'Capacity must be greater than 0' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO trucks (truck_number, route_id, capacity, availability_status)
       VALUES (?, ?, ?, ?)`,
      [truck_number.trim(), route_id, numCapacity, availability_status]
    );

    return res.status(201).json({
      success: true,
      message: 'Truck created successfully',
      data: { truck_id: result.insertId, truck_number, route_id, capacity: numCapacity, availability_status }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function updateTruckStatus(req, res) {
  const { id } = req.params;
  const { availability_status } = req.body;

  if (!['Available', 'In Transit', 'Maintenance'].includes(availability_status)) {
    return res.status(400).json({ success: false, message: 'Invalid availability status' });
  }

  try {
    await pool.query('UPDATE trucks SET availability_status = ? WHERE truck_id = ?', [availability_status, id]);
    return res.json({ success: true, message: 'Truck status updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ======================== SCHEDULES CRUD ========================
async function getAllSchedules(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, t.truck_number, r.origin, r.destination 
       FROM schedules s 
       JOIN trucks t ON s.truck_id = t.truck_id 
       JOIN routes r ON t.route_id = r.route_id 
       ORDER BY s.schedule_id ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function createSchedule(req, res) {
  const { truck_id, departure_time, departure_days, is_active = true } = req.body;

  if (!truck_id || !departure_time || !departure_days) {
    return res.status(400).json({ success: false, message: 'truck_id, departure_time (HH:MM:SS), and departure_days are required' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO schedules (truck_id, departure_time, departure_days, is_active)
       VALUES (?, ?, ?, ?)`,
      [truck_id, departure_time, departure_days.trim().toUpperCase(), is_active]
    );

    return res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: { schedule_id: result.insertId, truck_id, departure_time, departure_days, is_active }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ======================== CANDIDATE DEPARTURES (FOR SCHEDULER MODULE 6) ========================
async function getUpcomingDepartures(req, res) {
  try {
    const routeId = req.query.route_id ? parseInt(req.query.route_id, 10) : null;
    const simTime = req.query.sim_time ? new Date(req.query.sim_time) : new Date();

    const candidates = await getUpcomingDepartureCandidates(routeId, simTime);
    return res.json({ success: true, data: candidates });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAllRoutes,
  createRoute,
  getAllTrucks,
  createTruck,
  updateTruckStatus,
  getAllSchedules,
  createSchedule,
  getUpcomingDepartures
};

