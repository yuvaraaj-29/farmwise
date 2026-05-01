const express = require('express');
const { mlClient } = require('../config/mlClient');

const router = express.Router();

// GET /api/weather?lat=X&lon=Y
router.get('/', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon query params are required' });
    }
    const { data } = await mlClient.post('/weather', { lat: +lat, lon: +lon });
    res.json(data);
  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.detail || err.message;
    res.status(status).json({ error: message });
  }
});

// POST /api/weather
router.post('/', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }
    const { data } = await mlClient.post('/weather', { lat: +lat, lon: +lon });
    res.json(data);
  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.detail || err.message;
    res.status(status).json({ error: message });
  }
});

module.exports = router;
