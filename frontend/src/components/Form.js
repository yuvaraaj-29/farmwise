import React, { useState, useEffect } from 'react';

// ─── Field definitions ────────────────────────────────────────────────────────
const FIELDS = [
  { name: 'N',  label: 'Nitrogen (N)',   unit: 'mg/kg', min: 0,   max: 140, step: 1,   placeholder: '0–140'   },
  { name: 'P',  label: 'Phosphorus (P)', unit: 'mg/kg', min: 5,   max: 145, step: 1,   placeholder: '5–145'   },
  { name: 'K',  label: 'Potassium (K)',  unit: 'mg/kg', min: 5,   max: 205, step: 1,   placeholder: '5–205'   },
  { name: 'ph', label: 'Soil pH',        unit: '',       min: 3.5, max: 9.9, step: 0.1, placeholder: '3.5–9.9' },
];

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(form) {
  const errs = {};
  FIELDS.forEach(f => {
    const v = parseFloat(form[f.name]);
    if (form[f.name] === '')         errs[f.name] = 'Required';
    else if (isNaN(v))               errs[f.name] = 'Invalid number';
    else if (v < f.min || v > f.max) errs[f.name] = `Range: ${f.min}–${f.max}`;
  });
  return errs;
}

// ─── GPS ──────────────────────────────────────────────────────────────────────
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Not supported')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, method: 'GPS' }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// ─── City/Pincode → lat,lon using OpenWeatherMap Geocoding API ────────────────
// Uses your existing REACT_APP_OPEN_API_KEY — no extra key needed
async function searchCityCoords(query) {
  const key = process.env.REACT_APP_OPEN_API_KEY;
  if (!key) throw new Error('REACT_APP_OPEN_API_KEY not set');
  const r = await fetch(
    `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)},IN&limit=5&appid=${key}`
  );
  if (!r.ok) throw new Error(`Geocoding error ${r.status}`);
  const results = await r.json();
  if (!results.length) throw new Error('City not found');
  return results; // [{ name, lat, lon, state, country }]
}

// ─── Weather ──────────────────────────────────────────────────────────────────
async function fetchWeatherPreview(lat, lon) {
  // Primary: OpenWeatherMap (your paid key)
  const owKey = process.env.REACT_APP_OPEN_API_KEY;
  if (owKey) {
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owKey}&units=metric`
      );
      if (!r.ok) throw new Error(`OWM ${r.status}`);
      const d = await r.json();
      return {
        temperature: d.main.temp,
        humidity:    d.main.humidity,
        rainfall:    d.rain?.['1h'] ?? d.rain?.['3h'] ?? 0,
        source:      'OpenWeatherMap',
      };
    } catch (e) {
      console.warn('[Weather] OWM failed:', e.message);
    }
  }
  // Fallback: Open-Meteo (free)
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation&daily=precipitation_sum&timezone=auto&forecast_days=1`;
    const d = await (await fetch(url)).json();
    const cur = d.current || {};
    return {
      temperature: cur.temperature_2m,
      humidity:    cur.relative_humidity_2m,
      rainfall:    d.daily?.precipitation_sum?.[0] ?? cur.precipitation ?? 0,
      source:      'Open-Meteo',
    };
  } catch { return null; }
}

// ─── Inline styles ────────────────────────────────────────────────────────────
const S = {
  formWrapper: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '2rem 1rem',
    background: 'linear-gradient(135deg,#f0f7ee,#fef9ef)',
  },
  card: {
    width: '100%',
    maxWidth: '480px',
    background: '#fff',
    borderRadius: '20px',
    padding: '2rem',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  },
  title: { fontSize: '1.5rem', fontWeight: '700', color: '#1a1a2e', margin: '0 0 1.25rem' },
  locationBox: {
    background: '#f0fdf4',
    border: '1.5px solid #bbf7d0',
    borderRadius: '12px',
    padding: '0.9rem 1rem',
    marginBottom: '1.25rem',
  },
  locText:          { fontSize: '0.85rem', fontWeight: '600', color: '#166534', margin: '0 0 0.5rem' },
  locTextDetecting: { fontSize: '0.85rem', fontWeight: '600', color: '#92400e', margin: '0 0 0.5rem' },
  locTextError:     { fontSize: '0.85rem', fontWeight: '600', color: '#dc2626', margin: '0 0 0.5rem' },
  locCoords:        { fontSize: '0.70rem', color: '#6b7280', margin: '0 0 0.5rem', fontStyle: 'italic' },

  btnSecondary: {
    background: 'transparent',
    border: '1.5px solid #16a34a',
    color: '#16a34a',
    borderRadius: '8px',
    padding: '0.3rem 0.75rem',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    fontWeight: '600',
  },

  // GPS denied box
  gpsDeniedBox: {
    marginTop: '0.75rem',
    background: '#fff7ed',
    border: '1.5px solid #fed7aa',
    borderRadius: '10px',
    padding: '0.75rem 0.9rem',
  },
  gpsDeniedTitle: { fontSize: '0.78rem', fontWeight: '700', color: '#9a3412', margin: '0 0 0.5rem' },
  gpsDeniedHint:  { fontSize: '0.70rem', color: '#9a3412', margin: '0 0 0.6rem' },

  // City search input
  cityInputRow: { display: 'flex', gap: '0.4rem' },
  cityInput: {
    flex: 1,
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    padding: '0.5rem 0.7rem',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 0,
  },
  citySearchBtn: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.5rem 0.85rem',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  // Search results dropdown
  cityDropdown: {
    marginTop: '0.4rem',
    background: '#fff',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  cityItem: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.82rem',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid #f3f4f6',
    background: '#fff',
    transition: 'background 0.15s',
  },
  cityItemState: { fontSize: '0.70rem', color: '#6b7280' },
  citySearchErr: { fontSize: '0.72rem', color: '#dc2626', marginTop: '0.3rem', fontWeight: '600' },

  // Soil form
  form:      { display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  label:     { fontSize: '0.82rem', fontWeight: '600', color: '#374151' },
  labelUnit: { fontWeight: '400', color: '#6b7280', fontSize: '0.75rem' },
  input: {
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    padding: '0.6rem 0.8rem',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    background: '#fafafa',
  },
  error: { fontSize: '0.72rem', color: '#dc2626', fontWeight: '600' },
  btnPrimary: {
    background: 'linear-gradient(135deg,#16a34a,#166534)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '0.85rem',
    fontSize: '1rem',
    fontFamily: 'inherit',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '0.25rem',
  },

  // Weather
  weatherBox: {
    marginTop: '1.1rem',
    background: '#eff6ff',
    border: '1.5px solid #bfdbfe',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    minHeight: '2rem',
  },
  weatherGrid: {
    display: 'flex',
    justifyContent: 'space-around',
    fontSize: '0.88rem',
    fontWeight: '700',
    color: '#1e3a5f',
  },
  loading: { fontSize: '0.82rem', color: '#6b7280', textAlign: 'center', margin: 0 },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Form({ onPredict, loading }) {
  const [form, setForm] = useState({ N: '', P: '', K: '', ph: '' });
  const [errs, setErrs] = useState({});

  // Location
  const [location,    setLocation]    = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [gpsDenied,   setGpsDenied]   = useState(false);

  // City search (shown only when GPS denied)
  const [cityQuery,     setCityQuery]     = useState('');
  const [cityResults,   setCityResults]   = useState([]);
  const [citySearching, setCitySearching] = useState(false);
  const [cityErr,       setCityErr]       = useState('');

  // Weather
  const [weather,        setWeather]        = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => { detectLocation(); }, []);

  // ── GPS ──────────────────────────────────────────────────────────────────
  const detectLocation = async () => {
    setIsDetecting(true);
    setGpsDenied(false);
    setLocation(null);
    setWeather(null);
    setCityQuery('');
    setCityResults([]);
    setCityErr('');
    try {
      const loc = await getGPS();
      setLocation(loc);
      loadWeather(loc.lat, loc.lon);
    } catch {
      // GPS denied → show city search box, never call IP API
      setGpsDenied(true);
    } finally {
      setIsDetecting(false);
    }
  };

  // ── City search using OpenWeatherMap geocoding ────────────────────────────
  const handleCitySearch = async () => {
    if (!cityQuery.trim()) return;
    setCitySearching(true);
    setCityErr('');
    setCityResults([]);
    try {
      const results = await searchCityCoords(cityQuery.trim());
      setCityResults(results);
    } catch (e) {
      setCityErr(e.message === 'City not found'
        ? 'City not found. Try a different name (e.g. Sivakasi, Virudhunagar).'
        : 'Search failed. Check your internet connection.');
    } finally {
      setCitySearching(false);
    }
  };

  const handleCityPick = city => {
    const loc = { lat: city.lat, lon: city.lon, city: `${city.name}, ${city.state || city.country}`, method: 'City search' };
    setLocation(loc);
    setGpsDenied(false);
    setCityResults([]);
    setCityQuery('');
    loadWeather(city.lat, city.lon);
  };

  // ── Weather ───────────────────────────────────────────────────────────────
  const loadWeather = async (lat, lon) => {
    setWeatherLoading(true);
    setWeather(null);
    const w = await fetchWeatherPreview(lat, lon);
    setWeather(w);
    setWeatherLoading(false);
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrs(prev => { const n = { ...prev }; delete n[e.target.name]; return n; });
  };

  const handleSubmit = e => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length) return setErrs(errors);
    const payload = { N: +form.N, P: +form.P, K: +form.K, ph: +form.ph };
    if (location) { payload.lat = location.lat; payload.lon = location.lon; }
    if (weather)  { payload.temperature = weather.temperature; payload.humidity = weather.humidity; payload.rainfall = weather.rainfall; }
    onPredict(payload);
  };

  // ── locText / locCls (your original variable names) ───────────────────────
  const locText = isDetecting
    ? '📡 Detecting GPS…'
    : gpsDenied
      ? '❌ GPS denied — enter your city below'
      : location
        ? `📍 ${location.city}`
        : '—';

  const locCls = isDetecting ? 'detecting' : gpsDenied ? 'error' : location ? 'success' : '';

  const locTextStyle = isDetecting
    ? S.locTextDetecting
    : gpsDenied
      ? S.locTextError
      : S.locText;

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="form-wrapper" style={S.formWrapper}>

      <div className="card form-card" style={S.card}>

        <h2 className="title" style={S.title}>🌱 FarmWise Crop Predictor</h2>

        {/* LOCATION */}
        <div className="location-box" style={S.locationBox}>

          <p className={`loc-text ${locCls}`} style={locTextStyle}>{locText}</p>

          {/* Show coords when detected */}
          {location && !isDetecting && (
            <p style={S.locCoords}>
              {location.lat.toFixed(5)}, {location.lon.toFixed(5)} via {location.method}
            </p>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={S.btnSecondary}
            onClick={detectLocation}
            disabled={isDetecting || loading}
          >
            🔄 Refresh Location
          </button>

          {/* ── GPS DENIED: city search box appears here ── */}
          {gpsDenied && (
            <div style={S.gpsDeniedBox}>

              <p style={S.gpsDeniedTitle}>📍 Enter your city or district name</p>
              <p style={S.gpsDeniedHint}>
                GPS is off. IP location is unreliable in India — type your city for accurate weather.
              </p>

              <div style={S.cityInputRow}>
                <input
                  style={S.cityInput}
                  type="text"
                  placeholder="e.g. Sivakasi, Madurai, Coimbatore…"
                  value={cityQuery}
                  onChange={e => { setCityQuery(e.target.value); setCityErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCitySearch()}
                />
                <button
                  style={S.citySearchBtn}
                  type="button"
                  onClick={handleCitySearch}
                  disabled={citySearching}
                >
                  {citySearching ? '…' : '🔍 Search'}
                </button>
              </div>

              {cityErr && <div style={S.citySearchErr}>{cityErr}</div>}

              {cityResults.length > 0 && (
                <div style={S.cityDropdown}>
                  {cityResults.map((c, i) => (
                    <div
                      key={i}
                      style={S.cityItem}
                      onClick={() => handleCityPick(c)}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <span>{c.name}</span>
                      <span style={S.cityItemState}>{c.state}, {c.country}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
          {/* ── end GPS denied block ── */}

        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="form" style={S.form}>

          {FIELDS.map(f => (
            <div key={f.name} className="form-group" style={S.formGroup}>

              <label style={S.label}>
                {f.label} {f.unit && <span style={S.labelUnit}>({f.unit})</span>}
              </label>

              <input
                style={S.input}
                type="number"
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                min={f.min}
                max={f.max}
                step={f.step}
                placeholder={f.placeholder}
              />

              {errs[f.name] && (
                <small className="error" style={S.error}>{errs[f.name]}</small>
              )}
            </div>
          ))}

          <button className="btn-primary" style={S.btnPrimary} disabled={loading}>
            {loading ? 'Predicting...' : '🌾 Predict Crop'}
          </button>

        </form>

        {/* WEATHER */}
        <div className="weather-box" style={S.weatherBox}>

          {weatherLoading && (
            <p className="loading" style={S.loading}>Loading weather...</p>
          )}

          {weather && !weatherLoading && (
            <div className="weather-grid" style={S.weatherGrid}>
              <div>🌡 {weather.temperature}°C</div>
              <div>💧 {weather.humidity}%</div>
              <div>🌧 {weather.rainfall} mm</div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}