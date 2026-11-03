const { createBatchFromPlan, getBatchById, getAllBatches } = require('../services/batchService');
const schedulingEngine = require('../services/schedulingEngine');
const { getUpcomingDepartureCandidates } = require('../services/routeTruckService');

/**
 * Module 7: Generate Batch from explicit payload
 */
async function generateBatch(req, res) {
  try {
    const { route_id, truck_id, schedule_id, scheduled_departure, selected_parcel_ids } = req.body;

    const batch = await createBatchFromPlan({
      route_id,
      truck_id,
      schedule_id,
      scheduled_departure,
      selected_parcel_ids
    });

    return res.status(201).json({
      success: true,
      message: `Batch ${batch.batch_code} generated successfully`,
      data: batch
    });
  } catch (error) {
    console.error('Batch creation error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Module 6 & 7 Integrated: Auto-schedule and generate batch in one step
 */
async function autoScheduleAndBatch(req, res) {
  try {
    const { route_id, sim_time } = req.body;
    if (!route_id) {
      return res.status(400).json({ success: false, message: 'route_id is required' });
    }

    const simTime = sim_time ? new Date(sim_time) : new Date();

    // 1. Find earliest candidate departure
    const candidates = await getUpcomingDepartureCandidates(route_id, simTime);
    if (candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active upcoming departure candidates for Route ${route_id}`
      });
    }

    const candidate = candidates[0];

    // 2. Evaluate with Module 6 Scheduling Engine
    const evaluation = await schedulingEngine.scheduleDeparture(candidate, simTime);

    if (evaluation.allocated_parcels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible parcels could be allocated for this departure slot',
        evaluation
      });
    }

    // 3. Atomically create batch from allocated parcels
    const selectedParcelIds = evaluation.allocated_parcels.map(p => p.parcel_id);
    const batch = await createBatchFromPlan({
      route_id: candidate.route_id,
      truck_id: candidate.truck.truck_id,
      schedule_id: candidate.departure.schedule_id,
      scheduled_departure: candidate.departure.scheduled_departure,
      selected_parcel_ids: selectedParcelIds
    });

    return res.status(201).json({
      success: true,
      message: `Batch ${batch.batch_code} generated via auto-scheduling`,
      data: {
        batch,
        evaluation
      }
    });
  } catch (error) {
    console.error('Auto batch error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * List all batches
 */
async function listBatches(req, res) {
  try {
    const status = req.query.status || null;
    const batches = await getAllBatches(status);
    return res.json({ success: true, data: batches });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get batch details
 */
async function getBatch(req, res) {
  try {
    const { id } = req.params;
    const batch = await getBatchById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    return res.json({ success: true, data: batch });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  generateBatch,
  autoScheduleAndBatch,
  listBatches,
  getBatch
};

