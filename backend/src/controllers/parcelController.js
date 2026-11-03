const pool = require('../config/db');
const { validateParcelData } = require('../services/validationService');

function generateTrackingId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PCL-${dateStr}-${randomSuffix}`;
}

/**
 * Module 1 & 2: Validate and Register Parcel
 */
async function registerParcel(req, res) {
  const connection = await pool.getConnection();

  try {
    // Run Module 2 Validation
    const validation = await validateParcelData(req.body, connection);

    if (!validation.isValid) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const {
      sender_name,
      receiver_name,
      origin,
      destination,
      route_id,
      weight,
      urgency,
      arrival_time,
      deadline,
      max_wait_hours
    } = validation.data;

    const trackingId = generateTrackingId();

    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      `INSERT INTO parcels 
        (tracking_id, sender_name, receiver_name, origin, destination, route_id, weight, urgency, arrival_time, deadline, max_wait_hours, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')`,
      [
        trackingId,
        sender_name,
        receiver_name,
        origin,
        destination,
        route_id,
        weight,
        urgency,
        arrival_time,
        deadline,
        max_wait_hours
      ]
    );

    const parcelId = insertResult.insertId;

    await connection.query(
      `INSERT INTO parcel_status_history (parcel_id, previous_status, new_status, remarks)
       VALUES (?, NULL, 'Registered', 'Parcel registered and successfully validated')`,
      [parcelId]
    );

    await connection.commit();
    connection.release();

    // Module 3: Automatically enqueue parcel into incoming FIFO queue
    const queueManager = require('../services/queueService');
    await queueManager.enqueueParcel({
      parcel_id: parcelId,
      tracking_id: trackingId,
      arrival_time,
      route_id
    });

    return res.status(201).json({
      success: true,
      message: 'Parcel registered and placed in incoming queue successfully',
      data: {
        parcel_id: parcelId,
        tracking_id: trackingId,
        route_id,
        origin,
        destination,
        weight,
        status: 'Waiting for Sorting',
        validation_status: 'VALID'
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Parcel registration/validation error:', error);
    return res.status(500).json({ success: false, message: 'Server error during parcel registration' });
  }
}

/**
 * Direct standalone validation check endpoint (Module 2)
 */
async function validateParcel(req, res) {
  try {
    const validation = await validateParcelData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        validation_status: 'INVALID',
        errors: validation.errors
      });
    }
    return res.json({
      success: true,
      validation_status: 'VALID',
      data: validation.data
    });
  } catch (error) {
    console.error('Validation endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error during validation' });
  }
}

async function getRegisteredParcels(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, r.estimated_travel_hours, r.processing_buffer_hours 
       FROM parcels p 
       JOIN routes r ON p.route_id = r.route_id 
       ORDER BY p.parcel_id DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch parcels error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch parcels' });
  }
}

module.exports = { registerParcel, validateParcel, getRegisteredParcels };
