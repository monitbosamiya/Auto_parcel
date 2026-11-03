const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const parcelRoutes = require('./routes/parcelRoutes');
const queueRoutes = require('./routes/queueRoutes');
const sortingRoutes = require('./routes/sortingRoutes');
const fleetRoutes = require('./routes/fleetRoutes');
const schedulingRoutes = require('./routes/schedulingRoutes');
const batchRoutes = require('./routes/batchRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const incomingQueueManager = require('./services/queueService');
const destinationSortingService = require('./services/sortingService');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/sorting', sortingRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/tracking', trackingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Parcel Sorting & Dispatch Backend Running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Initialize incoming queue & route groups from database on startup
  await incomingQueueManager.initQueue();
  await destinationSortingService.initGroups();
});
