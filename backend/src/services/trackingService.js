const { HashTable } = require('../dsa/HashTable');
const pool = require('../config/db');

class TrackingService {
  constructor() {
    // Custom Hash Table acting as an O(1) in-memory tracking lookup cache
    this.trackingCache = new HashTable();
  }

  /**
   * Tracks a parcel by tracking_id
   * Uses Custom HashTable cache with fallback to authoritative MySQL queries
   */
  async trackParcel(trackingId) {
    const cleanId = trackingId.trim();

    // 1. Check Custom Hash Table cache
    const cached = this.trackingCache.get(cleanId);
    if (cached) {
      // Re-fetch history to ensure freshness while using cached core metadata
      const [history] = await pool.query(
        `SELECT previous_status, new_status, changed_at, remarks 
         FROM parcel_status_history 
         WHERE parcel_id = ? 
         ORDER BY history_id ASC`,
        [cached.parcel_id]
      );
      return { ...cached, history, from_cache: true };
    }

    // 2. Query MySQL database
    const [parcels] = await pool.query(
      `SELECT p.parcel_id, p.tracking_id, p.sender_name, p.receiver_name,
              p.origin, p.destination, p.weight, p.urgency, p.arrival_time, 
              p.deadline, p.max_wait_hours, p.status as current_status,
              r.estimated_travel_hours, r.processing_buffer_hours,
              b.batch_id, b.batch_code, b.scheduled_departure, b.batch_status,
              t.truck_number,
              dh.actual_departure, dh.dispatch_status
       FROM parcels p
       JOIN routes r ON p.route_id = r.route_id
       LEFT JOIN batch_parcels bp ON p.parcel_id = bp.parcel_id
       LEFT JOIN batches b ON bp.batch_id = b.batch_id
       LEFT JOIN trucks t ON b.truck_id = t.truck_id
       LEFT JOIN dispatch_history dh ON b.batch_id = dh.batch_id
       WHERE p.tracking_id = ?`,
      [cleanId]
    );

    if (parcels.length === 0) {
      return null;
    }

    const row = parcels[0];

    // 3. Fetch chronological status audit history
    const [history] = await pool.query(
      `SELECT previous_status, new_status, changed_at, remarks 
       FROM parcel_status_history 
       WHERE parcel_id = ? 
       ORDER BY history_id ASC`,
      [row.parcel_id]
    );

    const result = {
      parcel_id: row.parcel_id,
      tracking_id: row.tracking_id,
      current_status: row.current_status,
      sender_name: row.sender_name,
      receiver_name: row.receiver_name,
      origin: row.origin,
      destination: row.destination,
      weight: parseFloat(row.weight),
      urgency: row.urgency,
      arrival_time: row.arrival_time,
      deadline: row.deadline,
      max_wait_hours: row.max_wait_hours,
      batch: row.batch_id ? {
        batch_id: row.batch_id,
        batch_code: row.batch_code,
        truck_number: row.truck_number,
        scheduled_departure: row.scheduled_departure,
        actual_departure: row.actual_departure,
        batch_status: row.batch_status
      } : null,
      history
    };

    // 4. Store into in-memory Custom Hash Table
    this.trackingCache.set(cleanId, result);

    return { ...result, from_cache: false };
  }

  // Invalidate cache for a specific parcel when its status changes
  invalidate(trackingId) {
    if (trackingId) {
      this.trackingCache.delete(trackingId);
    }
  }
}

const trackingService = new TrackingService();
module.exports = trackingService;

