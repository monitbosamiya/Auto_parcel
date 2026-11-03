const pool = require('../config/db');
const destinationSortingService = require('./sortingService');

// Unique collision-safe batch code generator: e.g. BATCH-20261103-1234
function generateBatchCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `BATCH-${dateStr}-${randomSuffix}`;
}

/**
 * Module 7: Batch Generation Service
 * Atomically creates a batch from scheduler output / selected parcels
 */
async function createBatchFromPlan({
  route_id,
  truck_id,
  schedule_id,
  scheduled_departure,
  selected_parcel_ids
}) {
  if (!route_id || !truck_id || !schedule_id || !scheduled_departure) {
    throw new Error('route_id, truck_id, schedule_id, and scheduled_departure are required');
  }

  if (!Array.isArray(selected_parcel_ids) || selected_parcel_ids.length === 0) {
    throw new Error('selected_parcel_ids must be a non-empty array');
  }

  const plannedDepartureDate = new Date(scheduled_departure);
  if (isNaN(plannedDepartureDate.getTime())) {
    throw new Error('Invalid scheduled_departure timestamp format');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Recheck Truck & Route compatibility and availability
    const [trucks] = await connection.query(
      `SELECT t.*, r.route_id, r.origin, r.destination 
       FROM trucks t 
       JOIN routes r ON t.route_id = r.route_id 
       WHERE t.truck_id = ? FOR UPDATE`,
      [truck_id]
    );

    if (trucks.length === 0) {
      throw new Error(`Truck ID ${truck_id} not found`);
    }

    const truck = trucks[0];
    if (truck.route_id !== Number(route_id)) {
      throw new Error(`Truck ${truck.truck_number} is assigned to Route ${truck.route_id}, not Route ${route_id}`);
    }

    if (truck.availability_status === 'Maintenance') {
      throw new Error(`Truck ${truck.truck_number} is currently in Maintenance`);
    }

    // 2. Recheck Schedule is active
    const [schedules] = await connection.query(
      `SELECT * FROM schedules WHERE schedule_id = ? AND truck_id = ? AND is_active = TRUE`,
      [schedule_id, truck_id]
    );

    if (schedules.length === 0) {
      throw new Error(`Active schedule ID ${schedule_id} not found for Truck ${truck_id}`);
    }

    // 3. Confirm no duplicate batch exists for the same truck and departure slot
    const [existingBatches] = await connection.query(
      `SELECT batch_id, batch_code, batch_status 
       FROM batches 
       WHERE truck_id = ? AND scheduled_departure = ? AND batch_status != 'Cancelled'`,
      [truck_id, plannedDepartureDate]
    );

    if (existingBatches.length > 0) {
      throw new Error(`Batch (${existingBatches[0].batch_code}) already exists for Truck ${truck_id} at this departure slot`);
    }

    // 4. Lock & verify authoritative parcel records from MySQL
    const placeholders = selected_parcel_ids.map(() => '?').join(',');
    const [parcels] = await connection.query(
      `SELECT p.parcel_id, p.tracking_id, p.route_id, p.weight, p.status, bp.batch_id as existing_batch_id
       FROM parcels p
       LEFT JOIN batch_parcels bp ON p.parcel_id = bp.parcel_id
       WHERE p.parcel_id IN (${placeholders})
       FOR UPDATE`,
      selected_parcel_ids
    );

    if (parcels.length !== selected_parcel_ids.length) {
      throw new Error('One or more selected parcels do not exist in database');
    }

    let recalculatedWeight = 0;
    for (const p of parcels) {
      if (p.route_id !== Number(route_id)) {
        throw new Error(`Parcel ${p.tracking_id} route (${p.route_id}) does not match batch route (${route_id})`);
      }
      if (p.existing_batch_id || ['Batched', 'Dispatched', 'Delivered', 'Exception'].includes(p.status)) {
        throw new Error(`Parcel ${p.tracking_id} is already assigned or in status '${p.status}'`);
      }
      recalculatedWeight += parseFloat(p.weight);
    }

    recalculatedWeight = parseFloat(recalculatedWeight.toFixed(2));
    const truckCapacity = parseFloat(truck.capacity);

    // 5. Enforce truck capacity limit
    if (recalculatedWeight > truckCapacity) {
      throw new Error(`Total parcel weight (${recalculatedWeight} kg) exceeds truck capacity (${truckCapacity} kg)`);
    }

    // 6. Insert new Batches record (Initial status: 'Ready' per Module 7 spec)
    const batchCode = generateBatchCode();
    const [batchResult] = await connection.query(
      `INSERT INTO batches 
        (batch_code, truck_id, route_id, schedule_id, scheduled_departure, total_weight, parcel_count, batch_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Ready')`,
      [
        batchCode,
        truck_id,
        route_id,
        schedule_id,
        plannedDepartureDate,
        recalculatedWeight,
        parcels.length
      ]
    );

    const batchId = batchResult.insertId;

    // 7. Insert junction rows into batch_parcels
    const batchParcelValues = parcels.map(p => [batchId, p.parcel_id]);
    await connection.query(
      `INSERT INTO batch_parcels (batch_id, parcel_id) VALUES ?`,
      [batchParcelValues]
    );

    // 8. Update parcel statuses to 'Batched' and record status history
    await connection.query(
      `UPDATE parcels SET status = 'Batched' WHERE parcel_id IN (${placeholders})`,
      selected_parcel_ids
    );

    const historyValues = parcels.map(p => [
      p.parcel_id,
      p.status,
      'Batched',
      `Assigned to Batch ${batchCode}`
    ]);

    await connection.query(
      `INSERT INTO parcel_status_history (parcel_id, previous_status, new_status, remarks) VALUES ?`,
      [historyValues]
    );

    await connection.commit();

    // 9. Remove allocated parcels from runtime Route Linked List (Module 4)
    for (const p of parcels) {
      destinationSortingService.removeFromGroup(route_id, p.parcel_id);
    }

    return {
      batch_id: batchId,
      batch_code: batchCode,
      truck_id: Number(truck_id),
      truck_number: truck.truck_number,
      route_id: Number(route_id),
      schedule_id: Number(schedule_id),
      scheduled_departure: plannedDepartureDate.toISOString(),
      parcel_ids: selected_parcel_ids,
      total_weight: recalculatedWeight,
      parcel_count: parcels.length,
      batch_status: 'Ready'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Retrieve batch details with assigned parcels
 */
async function getBatchById(batchId) {
  const [batches] = await pool.query(
    `SELECT b.*, t.truck_number, t.capacity as truck_capacity, r.origin, r.destination 
     FROM batches b
     JOIN trucks t ON b.truck_id = t.truck_id
     JOIN routes r ON b.route_id = r.route_id
     WHERE b.batch_id = ?`,
    [batchId]
  );

  if (batches.length === 0) return null;
  const batch = batches[0];

  const [parcels] = await pool.query(
    `SELECT p.* 
     FROM parcels p
     JOIN batch_parcels bp ON p.parcel_id = bp.parcel_id
     WHERE bp.batch_id = ?`,
    [batchId]
  );

  return {
    ...batch,
    total_weight: parseFloat(batch.total_weight),
    truck_capacity: parseFloat(batch.truck_capacity),
    parcels
  };
}

/**
 * List all batches
 */
async function getAllBatches(status = null) {
  let query = `
    SELECT b.*, t.truck_number, t.capacity as truck_capacity, r.origin, r.destination 
    FROM batches b
    JOIN trucks t ON b.truck_id = t.truck_id
    JOIN routes r ON b.route_id = r.route_id
  `;
  const params = [];
  if (status) {
    query += ` WHERE b.batch_status = ?`;
    params.push(status);
  }
  query += ` ORDER BY b.batch_id DESC`;

  const [rows] = await pool.query(query, params);
  return rows.map(r => ({
    ...r,
    total_weight: parseFloat(r.total_weight),
    truck_capacity: parseFloat(r.truck_capacity)
  }));
}

module.exports = {
  createBatchFromPlan,
  getBatchById,
  getAllBatches,
  generateBatchCode
};

