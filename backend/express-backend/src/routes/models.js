const express = require('express');
const { mlClient } = require('../config/mlClient');

const router = express.Router();

// GET /api/models
router.get('/', async (req, res) => {
  try {
    const { data } = await mlClient.get('/models');
    res.json(data);
  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.detail || err.message;
    res.status(status).json({ error: message });
  }
});

module.exports = router;
