const { ParcelQueue } = require('../dsa/ParcelQueue');
const pool = require('../config/db');

class IncomingQueueManager {
  constructor() {
    this.queue = new ParcelQueue();
  }

  // Initialize/rebuild queue from MySQL on server startup
  async initQueue() {
    try {
      const [rows] = await pool.query(
        `SELECT parcel_id, tracking_id, arrival_time, route_id, status 
         FROM parcels 
         WHERE status IN ('Registered', 'Waiting for Sorting') 
         ORDER BY arrival_time ASC, parcel_id ASC`
      );

      this.queue = new ParcelQueue();
      for (const row of rows) {
        this.queue.enqueue({
          parcel_id: row.parcel_id,
          tracking_id: row.tracking_id,
          arrival_time: row.arrival_time,
          route_id: row.route_id
        });
      }
      console.log(`[IncomingQueue] Initialized queue with ${this.queue.size()} parcels awaiting sorting.`);
    } catch (error) {
      console.error('[IncomingQueue] Failed to initialize queue from DB:', error.message);
    }
  }

  // Enqueue parcel when registered
  async enqueueParcel(parcelRef) {
    if (this.queue.contains(parcelRef.parcel_id)) {
      throw new Error(`Parcel ID ${parcelRef.parcel_id} is already in the incoming queue`);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE parcels SET status = 'Waiting for Sorting' WHERE parcel_id = ?`,
        [parcelRef.parcel_id]
      );

      await connection.query(
        `INSERT INTO parcel_status_history (parcel_id, previous_status, new_status, remarks)
         VALUES (?, 'Registered', 'Waiting for Sorting', 'Enqueued into incoming FIFO queue')`,
        [parcelRef.parcel_id]
      );

      await connection.commit();

      // Safely enqueue in-memory only after successful DB commit
      this.queue.enqueue({
        parcel_id: parcelRef.parcel_id,
        tracking_id: parcelRef.tracking_id,
        arrival_time: parcelRef.arrival_time,
        route_id: parcelRef.route_id
      });

      return { success: true, queue_size: this.queue.size() };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  peekNext() {
    return this.queue.peek();
  }

  // Safe dequeue pattern: process state transition before popping in-memory queue
  async dequeueAndAdvanceStatus(newStatus = 'Sorted', remarks = 'Dequeued from incoming queue') {
    const nextParcel = this.queue.peek();
    if (!nextParcel) {
      return null;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `SELECT status FROM parcels WHERE parcel_id = ? FOR UPDATE`,
        [nextParcel.parcel_id]
      );

      if (rows.length === 0) {
        throw new Error(`Parcel ${nextParcel.parcel_id} not found in database`);
      }

      const currentStatus = rows[0].status;

      await connection.query(
        `UPDATE parcels SET status = ? WHERE parcel_id = ?`,
        [newStatus, nextParcel.parcel_id]
      );

      await connection.query(
        `INSERT INTO parcel_status_history (parcel_id, previous_status, new_status, remarks)
         VALUES (?, ?, ?, ?)`,
        [nextParcel.parcel_id, currentStatus, newStatus, remarks]
      );

      await connection.commit();

      // Now remove from in-memory queue
      return this.queue.dequeue();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  getQueueSnapshot() {
    return {
      size: this.queue.size(),
      items: this.queue.toArray()
    };
  }
}

// Singleton instance
const incomingQueueManager = new IncomingQueueManager();
module.exports = incomingQueueManager;

