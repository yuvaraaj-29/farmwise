const axios = require('axios');

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || 'http://localhost:8000';

const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

mlClient.interceptors.response.use(
  res => res,
  err => {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message;

    console.error(
      `[ML Client] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${msg}`
    );

    return Promise.reject(err);
  }
);

module.exports = { mlClient, ML_SERVICE_URL };