const destinationSortingService = require('../services/sortingService');
const incomingQueueManager = require('../services/queueService');

/**
 * Get all route groups and their linked list contents
 */
function getDestinationGroups(req, res) {
  try {
    const data = destinationSortingService.getAllGroupsSnapshot();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Dequeues the next parcel from Module 3 queue and sorts it into its destination group linked list
 */
async function processNextFromQueue(req, res) {
  try {
    const nextParcel = incomingQueueManager.peekNext();
    if (!nextParcel) {
      return res.status(404).json({ success: false, message: 'Incoming queue is empty. No parcels to sort.' });
    }

    // Sort into route linked list (advances parcel to 'Awaiting Dispatch' and saves history)
    const sortResult = await destinationSortingService.sortParcel(nextParcel);

    // After successful sorting, remove from incoming queue
    incomingQueueManager.queue.dequeue();

    return res.json({
      success: true,
      message: `Parcel ${sortResult.parcel.tracking_id} successfully sorted to route group '${sortResult.group_name}'`,
      data: sortResult
    });
  } catch (error) {
    console.error('Sort parcel error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Sort all waiting parcels currently in the queue
 */
async function processAllFromQueue(req, res) {
  try {
    const processed = [];
    while (!incomingQueueManager.queue.isEmpty()) {
      const nextParcel = incomingQueueManager.peekNext();
      const sortResult = await destinationSortingService.sortParcel(nextParcel);
      incomingQueueManager.queue.dequeue();
      processed.push(sortResult);
    }

    return res.json({
      success: true,
      message: `Sorted ${processed.length} parcel(s) successfully`,
      data: processed
    });
  } catch (error) {
    console.error('Batch sort error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getDestinationGroups,
  processNextFromQueue,
  processAllFromQueue
};

