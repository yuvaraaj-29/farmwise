const express = require('express');
const { mlClient } = require('../config/mlClient');

const router = express.Router();

/**
 * POST /api/predict
 *
 * Body:
 *   { N, P, K, ph, lat?, lon?, temperature?, humidity?, rainfall? }
 *
 * LOCATION FIX:
 *   If lat/lon are not provided, the ML service defaults to the center of India
 *   (20.59, 78.96). This means weather (temperature, humidity, rainfall) is
 *   fetched for that point, which can cause wrong predictions for users in
 *   specific regions. Always pass lat/lon from the frontend if available.
 *
 *   If lat/lon ARE provided they are forwarded verbatim to the ML service,
 *   which uses them to call the Open-Meteo weather API for that exact location.
 */
router.post('/', async (req, res) => {
  try {
    const { N, P, K, ph } = req.body;

    console.log("[PREDICT] Incoming:", req.body);

    const missing = ['N', 'P', 'K', 'ph'].filter(
      f => req.body[f] === undefined || req.body[f] === null
    );

    if (missing.length) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    const payload = {
      N: +N,
      P: +P,
      K: +K,
      ph: +ph
    };

    if (req.body.lat !== undefined) payload.lat = +req.body.lat;
    if (req.body.lon !== undefined) payload.lon = +req.body.lon;
    if (req.body.temperature !== undefined) payload.temperature = +req.body.temperature;
    if (req.body.humidity !== undefined) payload.humidity = +req.body.humidity;
    if (req.body.rainfall !== undefined) payload.rainfall = +req.body.rainfall;

    console.log("[PREDICT] Payload to ML:", payload);

    const response = await mlClient.post('/predict', payload);

    console.log("[ML RESPONSE]", response.data);

    res.json(response.data);

  } catch (err) {
    console.error("[PREDICT ERROR]", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });

    const status = err.response?.status || 500;

    const message =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.response?.data ||
      err.message ||
      'Prediction failed';

    res.status(status).json({ error: message });
  }
});

module.exports = router;
