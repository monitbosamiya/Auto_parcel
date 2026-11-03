const pool = require('../config/db');

const DAY_MAP = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT'
};

/**
 * Calculates the next departure Date object for a schedule based on a reference time
 */
function getNextDepartureDate(scheduleTimeStr, departureDaysStr, fromDate = new Date()) {
  const [hours, minutes, seconds] = scheduleTimeStr.split(':').map(Number);
  const activeDays = departureDaysStr.split(',').map(d => d.trim().toUpperCase());

  // Check the next 14 days to find the earliest valid recurring slot
  for (let offset = 0; offset <= 14; offset++) {
    const candidate = new Date(fromDate);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, seconds || 0, 0);

    const dayName = DAY_MAP[candidate.getDay()];
    if (activeDays.includes(dayName) && candidate > fromDate) {
      return candidate;
    }
  }
  return null;
}

/**
 * Find valid upcoming truck departure candidates for each route or a specific route
 */
async function getUpcomingDepartureCandidates(routeId = null, simTime = new Date()) {
  const referenceTime = new Date(simTime);

  let query = `
    SELECT 
      r.route_id, r.origin, r.destination, r.estimated_travel_hours, r.processing_buffer_hours,
      t.truck_id, t.truck_number, t.capacity, t.availability_status,
      s.schedule_id, s.departure_time, s.departure_days, s.is_active
    FROM routes r
    JOIN trucks t ON r.route_id = t.route_id
    JOIN schedules s ON t.truck_id = s.truck_id
    WHERE s.is_active = TRUE
      AND t.availability_status != 'Maintenance'
  `;
  const params = [];

  if (routeId) {
    query += ` AND r.route_id = ?`;
    params.push(routeId);
  }

  const [rows] = await pool.query(query, params);
  const candidates = [];

  for (const row of rows) {
    const nextDeparture = getNextDepartureDate(row.departure_time, row.departure_days, referenceTime);
    if (!nextDeparture) continue;

    // Check if truck has an active overlapping trip or already batched for this departure
    const [existingBatches] = await pool.query(
      `SELECT batch_id, scheduled_departure, batch_status 
       FROM batches 
       WHERE truck_id = ? 
         AND scheduled_departure = ? 
         AND batch_status IN ('Generated', 'Ready', 'Dispatched')`,
      [row.truck_id, nextDeparture]
    );

    // If already batched for this exact slot, skip creating duplicate candidate
    const alreadyScheduled = existingBatches.length > 0;

    candidates.push({
      route_id: row.route_id,
      origin: row.origin,
      destination: row.destination,
      estimated_travel_hours: parseFloat(row.estimated_travel_hours),
      processing_buffer_hours: parseFloat(row.processing_buffer_hours),
      truck: {
        truck_id: row.truck_id,
        truck_number: row.truck_number,
        capacity: parseFloat(row.capacity),
        availability_status: row.availability_status
      },
      departure: {
        schedule_id: row.schedule_id,
        scheduled_departure: nextDeparture.toISOString(),
        already_batched: alreadyScheduled
      }
    });
  }

  // Sort by earliest departure time
  candidates.sort((a, b) => new Date(a.departure.scheduled_departure) - new Date(b.departure.scheduled_departure));

  return candidates;
}

module.exports = {
  getNextDepartureDate,
  getUpcomingDepartureCandidates
};

