require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');

// Routes
const predictRoutes = require('./routes/predict');
const authRoutes = require('./routes/auth');
const weatherRoutes = require('./routes/weather');
const fertilizerRoutes = require('./routes/fertilizer');
const modelsRoutes = require('./routes/models');

// ML Client
const { mlClient } = require('./config/mlClient');

const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({ origin: '*' }));
app.use(express.json());

/* ---------------- ENV CHECK ---------------- */
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3001;

if (!MONGO_URI) {
  console.error('[MongoDB] ERROR: MONGO_URI is not defined in environment variables');
}

/* ---------------- MONGODB CONNECTION ---------------- */
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('[MongoDB] Connected'))
    .catch(err =>
      console.warn(`[MongoDB] Not connected: ${err.message}`)
    );
}

/* ---------------- ROUTES ---------------- */
app.use('/api/predict', predictRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/fertilizer', fertilizerRoutes);
app.use('/api/models', modelsRoutes);

/* ---------------- HEALTH CHECK ---------------- */
app.get('/api/health', async (req, res) => {
  let mlStatus = 'unknown';

  try {
    const r = await mlClient.get('/health', { timeout: 3000 });
    mlStatus = r.data?.status === 'ok' ? 'connected' : 'degraded';
  } catch {
    mlStatus = 'not connected';
  }

  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'not connected',
    ml_service: mlStatus,
  });
});

/* ---------------- 404 HANDLER ---------------- */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* ---------------- ERROR HANDLER ---------------- */
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

/* ---------------- START SERVER ---------------- */
app.listen(PORT, () => {
  console.log(`\n[FarmWise Express] Server running on port ${PORT}`);
  console.log(`[FarmWise Express] ML Service → ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);
});