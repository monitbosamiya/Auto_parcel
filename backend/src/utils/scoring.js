/**
 * Module 6: Scoring Algorithm according to Section 5, Module 6 specification
 *
 * priority_score = (urgency_score * 30) + (deadline_pressure_score * 35) + (travel_time_score * 15) + (waiting_time_score * 20)
 * Maximum total score = 100.
 */

function calculatePriorityScore(parcel, routeInfo, departureTime, simTime = new Date()) {
  const now = new Date(simTime);
  const depTime = new Date(departureTime);

  // 1. Urgency score (Weight: 30)
  // Urgent = 1.0, Normal = 0.5
  const urgency_score = parcel.urgency === 'Urgent' ? 1.0 : 0.5;

  // 2. Deadline pressure score (Weight: 35)
  // For parcels without deadline = 0.
  // For parcels with deadline: measures how close departure is to latest_safe_departure
  let deadline_pressure_score = 0;
  let latest_safe_departure = null;

  if (parcel.deadline) {
    const deadlineTime = new Date(parcel.deadline);
    const totalLeadHours = (routeInfo.estimated_travel_hours || 0) + (routeInfo.processing_buffer_hours || 0);
    latest_safe_departure = new Date(deadlineTime.getTime() - totalLeadHours * 3600 * 1000);

    const remainingSlackHours = (latest_safe_departure.getTime() - depTime.getTime()) / (3600 * 1000);

    if (remainingSlackHours <= 0) {
      // Departure is at or past latest safe departure (extreme pressure)
      deadline_pressure_score = 1.0;
    } else if (remainingSlackHours >= 48) {
      // 48 or more hours of slack (low pressure)
      deadline_pressure_score = 0.1;
    } else {
      // Bounded linear pressure from 48h down to 0h
      deadline_pressure_score = parseFloat((1.0 - (remainingSlackHours / 48) * 0.9).toFixed(4));
    }
  }

  // 3. Travel time score (Weight: 15)
  // Normalized against reference max (e.g. 24 hours) clamped between 0 and 1
  const maxRefTravelHours = 24.0;
  const travel_time_score = Math.min(Math.max((routeInfo.estimated_travel_hours || 0) / maxRefTravelHours, 0), 1.0);

  // 4. Waiting time score (Weight: 20)
  // min(waiting_duration / max_wait_hours, 1)
  const arrivalTime = new Date(parcel.arrival_time);
  const waitingHours = Math.max(0, (now.getTime() - arrivalTime.getTime()) / (3600 * 1000));
  const maxWait = parcel.max_wait_hours || 48;
  const waiting_time_score = Math.min(waitingHours / maxWait, 1.0);

  const totalScore = (
    urgency_score * 30 +
    deadline_pressure_score * 35 +
    travel_time_score * 15 +
    waiting_time_score * 20
  );

  return {
    priorityScore: parseFloat(totalScore.toFixed(2)),
    factors: {
      urgency_score,
      deadline_pressure_score,
      travel_time_score,
      waiting_time_score,
      latest_safe_departure
    }
  };
}

module.exports = { calculatePriorityScore };

