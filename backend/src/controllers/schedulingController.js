const schedulingEngine = require('../services/schedulingEngine');
const { getUpcomingDepartureCandidates } = require('../services/routeTruckService');

/**
 * Preview / Run scheduling evaluation for a specific route and departure
 */
async function evaluateSchedule(req, res) {
  try {
    const { route_id, sim_time } = req.body;

    if (!route_id) {
      return res.status(400).json({ success: false, message: 'route_id is required' });
    }

    const simTime = sim_time ? new Date(sim_time) : new Date();

    // 1. Fetch departure candidates for this route
    const candidates = await getUpcomingDepartureCandidates(route_id, simTime);
    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active upcoming truck departures found for Route ID ${route_id}`
      });
    }

    // 2. Select the earliest available upcoming departure
    const candidateDeparture = candidates[0];

    // 3. Run Scheduling Engine allocation algorithm
    const allocationResult = await schedulingEngine.scheduleDeparture(candidateDeparture, simTime);

    return res.json({
      success: true,
      data: {
        candidate_departure: candidateDeparture,
        evaluation: allocationResult
      }
    });
  } catch (error) {
    console.error('Schedule evaluation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { evaluateSchedule };

