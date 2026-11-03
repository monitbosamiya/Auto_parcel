const pool = require('../config/db');

/**
 * Module 8: Dispatch Management Service
 */

/**
 * Find batches due for departure (scheduled_departure <= simTime and status in Ready/Generated)
 */
async function getDueBatches(simTime = new Date()) {
  const currentSimTime = new Date(simTime);

  const [rows] = await pool.query(
    `SELECT b.*, t.truck_number, t.capacity as truck_capacity, t.availability_status as truck_status,
            r.origin, r.destination, r.estimated_travel_hours
     FROM batches b
     JOIN trucks t ON b.truck_id = t.truck_id
     JOIN routes r ON b.route_id = r.route_id
     WHERE b.scheduled_departure <= ? 
       AND b.batch_status IN ('Generated', 'Ready')
     ORDER BY b.scheduled_departure ASC`,
    [currentSimTime]
  );

  return rows.map(r => ({
    ...r,
    total_weight: parseFloat(r.total_weight),
    truck_capacity: parseFloat(r.truck_capacity)
  }));
}

/**
 * Atomically dispatch a batch
 */
async function dispatchBatch(batchId, simTime = new Date()) {
  const actualDepartureTime = new Date(simTime);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock and inspect batch record
    const [batches] = await connection.query(
      `SELECT b.*, t.truck_id, t.truck_number, t.availability_status as truck_status 
       FROM batches b
       JOIN trucks t ON b.truck_id = t.truck_id
       WHERE b.batch_id = ? FOR UPDATE`,
      [batchId]
    );

    if (batches.length === 0) {
      throw new Error(`Batch ID ${batchId} not found`);
    }

    const batch = batches[0];

    if (batch.batch_status === 'Dispatched') {
      throw new Error(`Batch ${batch.batch_code} has already been dispatched`);
    }

    if (!['Generated', 'Ready'].includes(batch.batch_status)) {
      throw new Error(`Batch ${batch.batch_code} cannot be dispatched from status '${batch.batch_status}'`);
    }

    // 2. Validate truck is operational
    if (batch.truck_status === 'Maintenance') {
      // Mark batch Delayed and exit
      await connection.query(
        `UPDATE batches SET batch_status = 'Delayed' WHERE batch_id = ?`,
        [batchId]
      );
      await connection.query(
        `INSERT INTO dispatch_history (batch_id, scheduled_departure, actual_departure, dispatch_status)
         VALUES (?, ?, NULL, 'Delayed')
         ON DUPLICATE KEY UPDATE dispatch_status = 'Delayed'`,
        [batchId, batch.scheduled_departure]
      );
      await connection.commit();
      throw new Error(`Truck ${batch.truck_number} is in Maintenance. Batch marked Delayed.`);
    }

    // 3. Lock assigned parcels and ensure they are still in 'Batched' status
    const [parcels] = await connection.query(
      `SELECT p.parcel_id, p.tracking_id, p.status 
       FROM parcels p
       JOIN batch_parcels bp ON p.parcel_id = bp.parcel_id
       WHERE bp.batch_id = ? FOR UPDATE`,
      [batchId]
    );

    if (parcels.length === 0) {
      throw new Error(`Batch ${batch.batch_code} has no assigned parcels`);
    }

    const invalidParcels = parcels.filter(p => p.status !== 'Batched');
    if (invalidParcels.length > 0) {
      throw new Error(`Parcels (${invalidParcels.map(p => p.tracking_id).join(', ')}) are not in 'Batched' state`);
    }

    const parcelIds = parcels.map(p => p.parcel_id);
    const placeholders = parcelIds.map(() => '?').join(',');

    // 4. Record dispatch history
    await connection.query(
      `INSERT INTO dispatch_history (batch_id, scheduled_departure, actual_departure, dispatch_status)
       VALUES (?, ?, ?, 'Dispatched')
       ON DUPLICATE KEY UPDATE actual_departure = VALUES(actual_departure), dispatch_status = 'Dispatched'`,
      [batchId, batch.scheduled_departure, actualDepartureTime]
    );

    // 5. Update batch status to 'Dispatched'
    await connection.query(
      `UPDATE batches SET batch_status = 'Dispatched' WHERE batch_id = ?`,
      [batchId]
    );

    // 6. Update truck status to 'In Transit'
    await connection.query(
      `UPDATE trucks SET availability_status = 'In Transit' WHERE truck_id = ?`,
      [batch.truck_id]
    );

    // 7. Update all assigned parcels to 'Dispatched'
    await connection.query(
      `UPDATE parcels SET status = 'Dispatched' WHERE parcel_id IN (${placeholders})`,
      parcelIds
    );

    // 8. Log status history for all dispatched parcels
    const historyEntries = parcelIds.map(pid => [
      pid,
      'Batched',
      'Dispatched',
      `Departed on truck ${batch.truck_number} (Batch: ${batch.batch_code})`
    ]);

    await connection.query(
      `INSERT INTO parcel_status_history (parcel_id, previous_status, new_status, remarks) VALUES ?`,
      [historyEntries]
    );

    await connection.commit();

    return {
      batch_id: batchId,
      batch_code: batch.batch_code,
      truck_number: batch.truck_number,
      scheduled_departure: batch.scheduled_departure,
      actual_departure: actualDepartureTime.toISOString(),
      dispatched_parcels_count: parcelIds.length,
      parcel_ids: parcelIds,
      dispatch_status: 'Dispatched'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all dispatch records
 */
async function getAllDispatches() {
  const [rows] = await pool.query(
    `SELECT d.*, b.batch_code, b.total_weight, b.parcel_count,
            t.truck_number, r.origin, r.destination 
     FROM dispatch_history d
     JOIN batches b ON d.batch_id = b.batch_id
     JOIN trucks t ON b.truck_id = t.truck_id
     JOIN routes r ON b.route_id = r.route_id
     ORDER BY d.dispatch_id DESC`
  );
  return rows;
}

module.exports = {
  getDueBatches,
  dispatchBatch,
  getAllDispatches
};

