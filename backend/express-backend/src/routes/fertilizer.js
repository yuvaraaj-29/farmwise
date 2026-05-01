const express = require('express');
const { mlClient } = require('../config/mlClient');

const router = express.Router();

// POST /api/fertilizer
router.post('/', async (req, res) => {
  try {
    const { crop, N = 0, P = 0, K = 0 } = req.body;
    if (!crop) {
      return res.status(400).json({ error: 'crop field is required' });
    }
    const { data } = await mlClient.post('/fertilizer', { crop, N: +N, P: +P, K: +K });
    res.json(data);
  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.detail || err.message;
    res.status(status).json({ error: message });
  }
});

module.exports = router;
