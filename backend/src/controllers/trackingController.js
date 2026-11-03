const trackingService = require('../services/trackingService');

/**
 * Module 9: Track a parcel by tracking_id
 */
async function trackParcel(req, res) {
  try {
    const trackingId = req.params.tracking_id || req.body.tracking_id;

    if (!trackingId || !trackingId.trim()) {
      return res.status(400).json({ success: false, message: 'tracking_id is required' });
    }

    const data = await trackingService.trackParcel(trackingId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: `No parcel found with tracking ID '${trackingId}'`
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Tracking error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { trackParcel };

