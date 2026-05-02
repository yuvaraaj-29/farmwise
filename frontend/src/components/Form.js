import React, { useState, useEffect } from 'react';

const FIELDS = [
  { name: 'N', label: 'Nitrogen (N)',   min: 0,   max: 140 },
  { name: 'P', label: 'Phosphorus (P)', min: 5,   max: 145 },
  { name: 'K', label: 'Potassium (K)',  min: 5,   max: 205 },
  { name: 'ph', label: 'Soil pH',       min: 3.5, max: 9.9 },
];

// ── Validation ────────────────────────────────────────────────────────────────
function validate(form) {
  const errs = {};
  FIELDS.forEach(f => {
    const v = parseFloat(form[f.name]);
    if (form[f.name] === '')      errs[f.name] = 'Required';
    else if (isNaN(v))            errs[f.name] = 'Invalid number';
    else if (v < f.min || v > f.max) errs[f.name] = `Range ${f.min}–${f.max}`;
  });
  return errs;
}

// ── GPS ───────────────────────────────────────────────────────────────────────
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

// ── IP geolocation (3-provider waterfall) ─────────────────────────────────────
async function getIPLocation() {
  const providers = [
    async () => {
      const r = await fetch('https://ipapi.co/json/');
      const d = await r.json();
      if (!d.latitude) throw new Error('no coords');
      return { lat: d.latitude, lon: d.longitude, city: d.city || '' };
    },
    async () => {
      const r = await fetch('https://ip-api.com/json/?fields=status,lat,lon,city');
      const d = await r.json();
      if (d.status !== 'success') throw new Error('failed');
      return { lat: d.lat, lon: d.lon, city: d.city || '' };
    },
    async () => {
      const r = await fetch('https://freeipapi.com/api/json');
      const d = await r.json();
      if (!d.latitude) throw new Error('no coords');
      return { lat: d.latitude, lon: d.longitude, city: d.cityName || '' };
    },
  ];
  for (const fn of providers) {
    try { return await fn(); } catch { /* try next */ }
  }
  return null;
}

// ── Weather via Open-Meteo (frontend display only) ────────────────────────────
// NOTE: The ML backend fetches its own weather using the lat/lon we send.
// This fetch is only for the UI preview shown in the form before submitting.
async function fetchWeatherPreview(lat, lon) {
  // Primary: Open-Meteo (free, no key)
  try {
    const url = [
      'https://api.open-meteo.com/v1/forecast',
      `?latitude=${lat}&longitude=${lon}`,
      '&current=temperature_2m,relative_humidity_2m,precipitation',
      '&daily=precipitation_sum',
      '&timezone=auto&forecast_days=1',
    ].join('');
    const r = await fetch(url);
    if (!r.ok) throw new Error('Open-Meteo error');
    const d = await r.json();
    const cur = d.current || {};
    const rainSum = d.daily?.precipitation_sum?.[0] ?? cur.precipitation ?? 0;
    return {
      temperature: cur.temperature_2m,
      humidity:    cur.relative_humidity_2m,
      rainfall:    rainSum,
      source:      'Open-Meteo',
    };
  } catch { /* fall through */ }

  // Fallback: WeatherAPI (needs env key, may be missing)
  const wKey = process.env.REACT_APP_WEATHER_API_KEY;
  if (wKey) {
    try {
      const r = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=${wKey}&q=${lat},${lon}`
      );
      if (!r.ok) throw new Error('WeatherAPI error');
      const d = await r.json();
      return {
        temperature: d.current.temp_c,
        humidity:    d.current.humidity,
        rainfall:    d.current.precip_mm || 0,
        source:      'WeatherAPI',
      };
    } catch { /* fall through */ }
  }

  // Fallback: OpenWeatherMap
  const owKey = process.env.REACT_APP_OPEN_API_KEY;
  if (owKey) {
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owKey}&units=metric`
      );
      if (!r.ok) throw new Error('OpenWeather error');
      const d = await r.json();
      return {
        temperature: d.main.temp,
        humidity:    d.main.humidity,
        rainfall:    d.rain?.['1h'] || 0,
        source:      'OpenWeather',
      };
    } catch { /* fall through */ }
  }

  return null; // all providers failed — UI shows nothing
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Form({ onPredict, loading }) {
  const [form, setForm] = useState({ N: '', P: '', K: '', ph: '' });
  const [errs, setErrs] = useState({});

  // Location state
  const [location, setLocation] = useState(null); // { lat, lon, city, method }
  const [locStatus, setLocStatus] = useState('idle'); // idle | detecting | detected | denied

  // Weather preview state (for UI only)
  const [weather, setWeather]           = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => { detectLocation(); }, []);

  // ── Location detection ────────────────────────────────────────────────────
  const detectLocation = async () => {
    setLocStatus('detecting');
    setWeather(null);
    setLocation(null);

    // 1) GPS (most accurate)
    try {
      const { lat, lon } = await getGPS();
      const loc = { lat, lon, city: '', method: 'GPS' };
      setLocation(loc);
      setLocStatus('detected');
      loadWeatherPreview(lat, lon);
      return;
    } catch (e) {
      console.warn('[FarmWise] GPS failed:', e.message, '→ trying IP');
    }

    // 2) IP geolocation (approximate, but works without permission)
    const ip = await getIPLocation();
    if (ip) {
      const loc = { lat: ip.lat, lon: ip.lon, city: ip.city || '', method: 'IP' };
      setLocation(loc);
      setLocStatus('detected');
      loadWeatherPreview(ip.lat, ip.lon);
      return;
    }

    // 3) Nothing worked
    console.warn('[FarmWise] All location methods failed');
    setLocStatus('denied');
  };

  // ── Weather preview (UI only) ─────────────────────────────────────────────
  const loadWeatherPreview = async (lat, lon) => {
    setWeatherLoading(true);
    try {
      const w = await fetchWeatherPreview(lat, lon);
      setWeather(w);
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrs({});
  };

  const handleSubmit = e => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length) return setErrs(errors);

    // Always include lat/lon so the backend fetches weather for the right place.
    // Also include the frontend-fetched weather values if available — the backend
    // will use those directly and skip its own re-fetch, saving latency.
    const payload = {
      N:  +form.N,
      P:  +form.P,
      K:  +form.K,
      ph: +form.ph,
    };

    if (location != null) {
      payload.lat = location.lat;
      payload.lon = location.lon;
    }

    // Send frontend weather so backend uses consistent values shown to the user
    if (weather) {
      payload.temperature = weather.temperature;
      payload.humidity    = weather.humidity;
      payload.rainfall    = weather.rainfall;
    }

    onPredict(payload);
  };

  // ── Location display text ─────────────────────────────────────────────────
  const locationText = (() => {
    if (locStatus === 'detecting') return '📡 Detecting location…';
    if (locStatus === 'detected' && location) {
      const place = location.city
        ? `${location.city} (${location.lat.toFixed(3)}, ${location.lon.toFixed(3)})`
        : `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`;
      return `📍 ${location.method}: ${place}`;
    }
    return '❌ Location unavailable — weather will use regional averages';
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="form-wrapper">
      <div className="card">
        <h2>🌱 FarmWise Crop Predictor</h2>

        {/* Location */}
        <div className="location-box">
          <p>{locationText}</p>
          <button type="button" onClick={detectLocation} disabled={locStatus === 'detecting'}>
            🔄 Refresh Location
          </button>
        </div>

        {/* Soil inputs */}
        <form onSubmit={handleSubmit}>
          {FIELDS.map(f => (
            <div key={f.name}>
              <label>{f.label}</label>
              <input
                type="number"
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                step="any"
              />
              {errs[f.name] && (
                <small style={{ color: 'red' }}>{errs[f.name]}</small>
              )}
            </div>
          ))}
          <button disabled={loading}>
            {loading ? 'Predicting…' : '🌾 Predict Crop'}
          </button>
        </form>

        {/* Weather preview */}
        {weatherLoading && <p>Loading weather…</p>}
        {weather && !weatherLoading && (
          <div className="weather-box">
            <p>🌡 Temp: {weather.temperature}°C</p>
            <p>💧 Humidity: {weather.humidity}%</p>
            <p>🌧 Rain: {weather.rainfall} mm</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
              Source: {weather.source}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}