const incomingQueueManager = require('../services/queueService');

function getQueueStatus(req, res) {
  try {
    const snapshot = incomingQueueManager.getQueueSnapshot();
    return res.json({ success: true, data: snapshot });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function enqueueManually(req, res) {
  const { parcel_id } = req.body;
  if (!parcel_id) {
    return res.status(400).json({ success: false, message: 'parcel_id is required' });
  }

  try {
    const result = await incomingQueueManager.enqueueParcel({ parcel_id });
    return res.json({ success: true, message: 'Parcel enqueued successfully', data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function dequeueNext(req, res) {
  try {
    const parcel = await incomingQueueManager.dequeueAndAdvanceStatus('Sorted', 'Manually dequeued for sorting');
    if (!parcel) {
      return res.status(404).json({ success: false, message: 'Queue is empty' });
    }
    return res.json({ success: true, message: 'Parcel dequeued successfully', data: parcel });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { getQueueStatus, enqueueManually, dequeueNext };

