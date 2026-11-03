const pool = require('../config/db');

/**
 * Module 2: Parcel Validation Service
 * Validates parcel data against business rules and database constraints
 */
async function validateParcelData(parcelInput, dbConnection = null) {
  const conn = dbConnection || pool;
  const errors = [];

  const {
    sender_name,
    receiver_name,
    origin,
    destination,
    weight,
    urgency = 'Normal',
    deadline,
    max_wait_hours = 48
  } = parcelInput;

  // 1. Sender & Receiver validation
  if (!sender_name || typeof sender_name !== 'string' || !sender_name.trim()) {
    errors.push('Sender name cannot be empty');
  }
  if (!receiver_name || typeof receiver_name !== 'string' || !receiver_name.trim()) {
    errors.push('Receiver name cannot be empty');
  }

  // 2. Origin & Destination validation
  const cleanOrigin = origin ? origin.trim() : '';
  const cleanDest = destination ? destination.trim() : '';
  if (!cleanOrigin || !cleanDest) {
    errors.push('Origin and Destination are required');
  } else if (cleanOrigin.toLowerCase() === cleanDest.toLowerCase()) {
    errors.push('Origin and Destination must be different');
  }

  // 3. Weight validation
  const numWeight = parseFloat(weight);
  if (isNaN(numWeight) || numWeight <= 0) {
    errors.push('Weight must be a positive number greater than 0');
  }

  // 4. Urgency validation
  if (!['Normal', 'Urgent'].includes(urgency)) {
    errors.push('Urgency must be either "Normal" or "Urgent"');
  }

  // 5. Max wait hours
  const numMaxWait = parseInt(max_wait_hours, 10);
  if (isNaN(numMaxWait) || numMaxWait <= 0) {
    errors.push('Max wait hours must be a positive number');
  }

  // 6. Deadline validation
  const arrivalTime = parcelInput.arrival_time ? new Date(parcelInput.arrival_time) : new Date();
  let parsedDeadline = null;
  if (deadline) {
    parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      errors.push('Invalid deadline date format');
    } else if (parsedDeadline < arrivalTime) {
      errors.push('Deadline cannot be earlier than parcel arrival time');
    }
  }

  // Return early if basic input validation fails
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 7. Route lookup in database
  const [routes] = await conn.query(
    'SELECT * FROM routes WHERE origin = ? AND destination = ? LIMIT 1',
    [cleanOrigin, cleanDest]
  );

  if (routes.length === 0) {
    errors.push(`No directed shipping route found from '${cleanOrigin}' to '${cleanDest}'`);
    return { isValid: false, errors };
  }

  const route = routes[0];

  // 8. Service availability & truck capacity check on the route
  const [trucks] = await conn.query(
    `SELECT t.truck_id, t.capacity, t.availability_status, COUNT(s.schedule_id) as active_schedules
     FROM trucks t
     LEFT JOIN schedules s ON t.truck_id = s.truck_id AND s.is_active = TRUE
     WHERE t.route_id = ?
     GROUP BY t.truck_id`,
    [route.route_id]
  );

  if (trucks.length === 0) {
    errors.push(`Route '${cleanOrigin} -> ${cleanDest}' currently has no assigned trucks`);
    return { isValid: false, errors };
  }

  const hasActiveSchedule = trucks.some(t => t.active_schedules > 0);
  if (!hasActiveSchedule) {
    errors.push(`Route '${cleanOrigin} -> ${cleanDest}' has trucks but no active departure schedule`);
    return { isValid: false, errors };
  }

  // 9. Weight vs Max Truck Capacity check
  const maxTruckCapacity = Math.max(...trucks.map(t => parseFloat(t.capacity)));
  if (numWeight > maxTruckCapacity) {
    errors.push(`Parcel weight (${numWeight} kg) exceeds maximum truck capacity (${maxTruckCapacity} kg) on this route`);
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      sender_name: sender_name.trim(),
      receiver_name: receiver_name.trim(),
      origin: cleanOrigin,
      destination: cleanDest,
      route_id: route.route_id,
      weight: numWeight,
      urgency,
      arrival_time: arrivalTime,
      deadline: parsedDeadline,
      max_wait_hours: numMaxWait,
      route
    }
  };
}

module.exports = { validateParcelData };

