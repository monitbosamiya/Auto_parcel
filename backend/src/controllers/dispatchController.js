const { getDueBatches, dispatchBatch, getAllDispatches } = require('../services/dispatchService');

/**
 * Get batches currently due for departure based on simulation or real time
 */
async function listDueBatches(req, res) {
  try {
    const simTime = req.query.sim_time ? new Date(req.query.sim_time) : new Date();
    const dueBatches = await getDueBatches(simTime);
    return res.json({ success: true, count: dueBatches.length, data: dueBatches });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Trigger departure dispatch for a specific batch
 */
async function processDispatch(req, res) {
  try {
    const { batch_id, sim_time } = req.body;
    if (!batch_id) {
      return res.status(400).json({ success: false, message: 'batch_id is required' });
    }

    const simTime = sim_time ? new Date(sim_time) : new Date();
    const result = await dispatchBatch(batch_id, simTime);

    return res.json({
      success: true,
      message: `Batch ${result.batch_code} dispatched successfully`,
      data: result
    });
  } catch (error) {
    console.error('Dispatch error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Get dispatch departure history log
 */
async function listDispatches(req, res) {
  try {
    const dispatches = await getAllDispatches();
    return res.json({ success: true, data: dispatches });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  listDueBatches,
  processDispatch,
  listDispatches
};

