import React, { useState, useEffect, useRef } from 'react';

// ─── Soil input field definitions ────────────────────────────────────────────
const FIELDS = [
  { name: 'N',  label: 'Nitrogen (N)',   unit: 'mg/kg', min: 0,   max: 140, icon: '🟦' },
  { name: 'P',  label: 'Phosphorus (P)', unit: 'mg/kg', min: 5,   max: 145, icon: '🟧' },
  { name: 'K',  label: 'Potassium (K)',  unit: 'mg/kg', min: 5,   max: 205, icon: '🟩' },
  { name: 'ph', label: 'Soil pH',        unit: '',       min: 3.5, max: 9.9, icon: '⚗️' },
];

// ─── Popular Indian cities with accurate coordinates ─────────────────────────
const CITY_PRESETS = [
  // Tamil Nadu
  { name: 'Sivakasi',      state: 'Tamil Nadu',     lat: 9.4533,  lon: 77.8025 },
  { name: 'Chennai',       state: 'Tamil Nadu',     lat: 13.0827, lon: 80.2707 },
  { name: 'Coimbatore',    state: 'Tamil Nadu',     lat: 11.0168, lon: 76.9558 },
  { name: 'Madurai',       state: 'Tamil Nadu',     lat: 9.9252,  lon: 78.1198 },
  { name: 'Tirunelveli',   state: 'Tamil Nadu',     lat: 8.7139,  lon: 77.7567 },
  { name: 'Salem',         state: 'Tamil Nadu',     lat: 11.6643, lon: 78.1460 },
  { name: 'Trichy',        state: 'Tamil Nadu',     lat: 10.7905, lon: 78.7047 },
  { name: 'Erode',         state: 'Tamil Nadu',     lat: 11.3410, lon: 77.7172 },
  { name: 'Vellore',       state: 'Tamil Nadu',     lat: 12.9165, lon: 79.1325 },
  { name: 'Thoothukudi',   state: 'Tamil Nadu',     lat: 8.7642,  lon: 78.1348 },
  { name: 'Dindigul',      state: 'Tamil Nadu',     lat: 10.3624, lon: 77.9695 },
  { name: 'Thanjavur',     state: 'Tamil Nadu',     lat: 10.7870, lon: 79.1378 },
  { name: 'Virudhunagar',  state: 'Tamil Nadu',     lat: 9.5810,  lon: 77.9624 },
  { name: 'Ramanathapuram',state: 'Tamil Nadu',     lat: 9.3712,  lon: 78.8302 },
  { name: 'Nagercoil',     state: 'Tamil Nadu',     lat: 8.1833,  lon: 77.4119 },
  // Other States
  { name: 'Bengaluru',     state: 'Karnataka',      lat: 12.9716, lon: 77.5946 },
  { name: 'Hyderabad',     state: 'Telangana',      lat: 17.3850, lon: 78.4867 },
  { name: 'Mumbai',        state: 'Maharashtra',    lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi',         state: 'Delhi',          lat: 28.7041, lon: 77.1025 },
  { name: 'Kolkata',       state: 'West Bengal',    lat: 22.5726, lon: 88.3639 },
  { name: 'Ahmedabad',     state: 'Gujarat',        lat: 23.0225, lon: 72.5714 },
  { name: 'Pune',          state: 'Maharashtra',    lat: 18.5204, lon: 73.8567 },
  { name: 'Jaipur',        state: 'Rajasthan',      lat: 26.9124, lon: 75.7873 },
  { name: 'Lucknow',       state: 'Uttar Pradesh',  lat: 26.8467, lon: 80.9462 },
  { name: 'Bhopal',        state: 'Madhya Pradesh', lat: 23.2599, lon: 77.4126 },
  { name: 'Patna',         state: 'Bihar',          lat: 25.5941, lon: 85.1376 },
  { name: 'Bhubaneswar',   state: 'Odisha',         lat: 20.2961, lon: 85.8245 },
  { name: 'Kochi',         state: 'Kerala',         lat: 9.9312,  lon: 76.2673 },
  { name: 'Guwahati',      state: 'Assam',          lat: 26.1445, lon: 91.7362 },
  { name: 'Chandigarh',    state: 'Punjab',         lat: 30.7333, lon: 76.7794 },
  { name: 'Nagpur',        state: 'Maharashtra',    lat: 21.1458, lon: 79.0882 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lon: 83.2185 },
];

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(form) {
  const errs = {};
  FIELDS.forEach(f => {
    const v = parseFloat(form[f.name]);
    if (form[f.name] === '')           errs[f.name] = 'Required';
    else if (isNaN(v))                 errs[f.name] = 'Invalid number';
    else if (v < f.min || v > f.max)   errs[f.name] = `Range: ${f.min}–${f.max}`;
  });
  return errs;
}

// ─── GPS ──────────────────────────────────────────────────────────────────────
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

// ─── Weather fetch (Open-Meteo) ───────────────────────────────────────────────
async function fetchWeatherPreview(lat, lon) {
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
  } catch {
    return null;
  }
}

// ─── Reverse geocode city name from coords (Open-Meteo geocoding) ─────────────
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const d = await r.json();
    const addr = d.address || {};
    return addr.city || addr.town || addr.village || addr.county || '';
  } catch {
    return '';
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --soil:   #8B5E3C;
    --leaf:   #3A7D44;
    --sky:    #2E86AB;
    --sun:    #F4A261;
    --cream:  #FEF9EF;
    --dark:   #1A1A2E;
    --muted:  #6B7280;
    --error:  #EF4444;
    --radius: 14px;
    --shadow: 0 4px 24px rgba(0,0,0,0.08);
  }

  body { font-family: 'Space Mono', monospace; background: var(--cream); color: var(--dark); min-height: 100vh; }

  .fw-wrap {
    min-height: 100vh;
    background: linear-gradient(135deg, #f0f7ee 0%, #fef9ef 50%, #e8f4fd 100%);
    padding: 2rem 1rem 4rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .fw-card {
    width: 100%;
    max-width: 520px;
    background: #fff;
    border-radius: 24px;
    box-shadow: 0 8px 40px rgba(58,125,68,0.10), 0 2px 8px rgba(0,0,0,0.05);
    overflow: hidden;
  }

  .fw-header {
    background: linear-gradient(135deg, var(--leaf) 0%, #2d6a4f 100%);
    padding: 2rem 2rem 1.5rem;
    color: #fff;
  }

  .fw-header h1 {
    font-family: 'Syne', sans-serif;
    font-size: 1.8rem;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .fw-header p { font-size: 0.82rem; opacity: 0.8; margin-top: 0.25rem; }

  .fw-body { padding: 1.75rem 2rem; }

  /* ── Location Panel ── */
  .loc-panel {
    background: #f8fffe;
    border: 1.5px solid #c8e6c9;
    border-radius: var(--radius);
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }

  .loc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .loc-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--leaf); }

  .loc-refresh {
    background: none;
    border: 1.5px solid var(--leaf);
    color: var(--leaf);
    border-radius: 8px;
    padding: 0.25rem 0.6rem;
    font-size: 0.72rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
  }
  .loc-refresh:hover { background: var(--leaf); color: #fff; }

  .loc-status {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--dark);
    min-height: 1.2rem;
  }

  .loc-coords { font-size: 0.72rem; color: var(--muted); margin-top: 0.15rem; }

  .loc-warning {
    background: #fff8e1;
    border: 1.5px solid #ffcc02;
    border-radius: 10px;
    padding: 0.6rem 0.9rem;
    font-size: 0.78rem;
    color: #92400e;
    margin-top: 0.75rem;
    font-weight: 600;
  }

  /* ── City Search ── */
  .city-search-wrap { margin-top: 0.75rem; }

  .city-search-input {
    width: 100%;
    border: 1.5px solid #d1d5db;
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: border 0.2s;
  }
  .city-search-input:focus { border-color: var(--leaf); }

  .city-dropdown {
    background: #fff;
    border: 1.5px solid #d1d5db;
    border-radius: 10px;
    margin-top: 0.35rem;
    max-height: 220px;
    overflow-y: auto;
    box-shadow: var(--shadow);
  }

  .city-item {
    padding: 0.6rem 0.9rem;
    cursor: pointer;
    font-size: 0.82rem;
    border-bottom: 1px solid #f3f4f6;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.15s;
  }
  .city-item:last-child { border-bottom: none; }
  .city-item:hover { background: #f0fdf4; }
  .city-state { font-size: 0.7rem; color: var(--muted); }

  /* ── Manual Coords ── */
  .manual-wrap { margin-top: 0.75rem; }

  .manual-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.4rem;
  }

  .manual-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.5rem;
  }

  .manual-input {
    border: 1.5px solid #d1d5db;
    border-radius: 10px;
    padding: 0.55rem 0.7rem;
    font-family: inherit;
    font-size: 0.82rem;
    outline: none;
    transition: border 0.2s;
    width: 100%;
  }
  .manual-input:focus { border-color: var(--sky); }

  .manual-btn {
    background: var(--sky);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 0.55rem 0.8rem;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }
  .manual-btn:hover { background: #1a6d90; }

  .map-hint {
    font-size: 0.7rem;
    color: var(--muted);
    margin-top: 0.3rem;
  }
  .map-hint a { color: var(--sky); text-decoration: none; font-weight: 700; }

  /* ── Weather Preview ── */
  .weather-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .weather-chip {
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.5rem 0.6rem;
    text-align: center;
  }

  .weather-chip .wc-icon { font-size: 1.1rem; }
  .weather-chip .wc-val  { font-size: 0.88rem; font-weight: 700; color: var(--dark); margin-top: 0.1rem; }
  .weather-chip .wc-lbl  { font-size: 0.65rem; color: var(--muted); margin-top: 0.05rem; }

  .weather-loading { font-size: 0.78rem; color: var(--muted); margin-top: 0.5rem; }

  /* ── Soil Section ── */
  .section-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    margin-bottom: 0.85rem;
  }

  .fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
    margin-bottom: 1.5rem;
  }

  .field-group { display: flex; flex-direction: column; gap: 0.3rem; }

  .field-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--dark);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .field-input {
    border: 1.5px solid #e5e7eb;
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    transition: border 0.2s, box-shadow 0.2s;
    width: 100%;
    color: var(--dark);
    background: #fafafa;
  }
  .field-input:focus { border-color: var(--leaf); box-shadow: 0 0 0 3px rgba(58,125,68,0.1); background: #fff; }
  .field-input.error { border-color: var(--error); }

  .field-unit { font-size: 0.65rem; color: var(--muted); font-weight: 400; }
  .field-error { font-size: 0.68rem; color: var(--error); font-weight: 600; }

  /* ── Submit ── */
  .submit-btn {
    width: 100%;
    background: linear-gradient(135deg, var(--leaf), #2d6a4f);
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 1rem;
    font-family: 'Syne', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.3px;
    transition: opacity 0.2s, transform 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .submit-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── Spinner ── */
  .spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Pulse dot ── */
  .pulse-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--leaf);
    display: inline-block;
    margin-right: 6px;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.7); }
  }

  @media (max-width: 420px) {
    .fw-header { padding: 1.5rem; }
    .fw-body   { padding: 1.25rem; }
    .fields-grid { grid-template-columns: 1fr; }
    .manual-row { grid-template-columns: 1fr 1fr; }
    .manual-btn { grid-column: 1 / -1; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function Form({ onPredict, loading }) {
  const [form, setForm] = useState({ N: '', P: '', K: '', ph: '' });
  const [errs, setErrs] = useState({});

  // Location
  const [location, setLocation]   = useState(null);  // { lat, lon, city, method }
  const [locStatus, setLocStatus] = useState('idle'); // idle | detecting | gps_ok | gps_denied | manual
  const [showCitySearch, setShowCitySearch] = useState(false);

  // City search
  const [cityQuery, setCityQuery]   = useState('');
  const [cityResults, setCityResults] = useState([]);
  const searchRef = useRef(null);

  // Manual coords
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualErr, setManualErr] = useState('');

  // Weather
  const [weather, setWeather]             = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Inject styles
  useEffect(() => {
    const tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // Auto-detect on mount
  useEffect(() => { triggerGPS(); }, []);

  // City search filter
  useEffect(() => {
    if (!cityQuery.trim()) { setCityResults([]); return; }
    const q = cityQuery.toLowerCase();
    const matches = CITY_PRESETS.filter(
      c => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)
    ).slice(0, 10);
    setCityResults(matches);
  }, [cityQuery]);

  // ── GPS detection ──────────────────────────────────────────────────────────
  const triggerGPS = async () => {
    setLocStatus('detecting');
    setLocation(null);
    setWeather(null);
    setShowCitySearch(false);

    try {
      const { lat, lon } = await getGPS();
      const city = await reverseGeocode(lat, lon);
      const loc = { lat, lon, city, method: 'GPS' };
      setLocation(loc);
      setLocStatus('gps_ok');
      loadWeather(lat, lon);
    } catch (err) {
      console.warn('[FarmWise] GPS failed:', err.message);
      // GPS was denied or unavailable — show city picker immediately
      setLocStatus('gps_denied');
      setShowCitySearch(true);
    }
  };

  // ── Load weather ───────────────────────────────────────────────────────────
  const loadWeather = async (lat, lon) => {
    setWeatherLoading(true);
    setWeather(null);
    try {
      const w = await fetchWeatherPreview(lat, lon);
      setWeather(w);
    } finally {
      setWeatherLoading(false);
    }
  };

  // ── City picker ────────────────────────────────────────────────────────────
  const handleCityPick = city => {
    const loc = { lat: city.lat, lon: city.lon, city: city.name, method: 'City' };
    setLocation(loc);
    setLocStatus('manual');
    setShowCitySearch(false);
    setCityQuery('');
    setCityResults([]);
    loadWeather(city.lat, city.lon);
  };

  // ── Manual coords ──────────────────────────────────────────────────────────
  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || lat < 6 || lat > 37)  { setManualErr('Lat must be 6–37 for India'); return; }
    if (isNaN(lon) || lon < 68 || lon > 98) { setManualErr('Lon must be 68–98 for India'); return; }
    setManualErr('');
    const loc = { lat, lon, city: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, method: 'Manual' };
    setLocation(loc);
    setLocStatus('manual');
    loadWeather(lat, lon);
  };

  // ── Form handlers ──────────────────────────────────────────────────────────
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

  // ── Location display ───────────────────────────────────────────────────────
  const locDisplay = () => {
    if (locStatus === 'detecting')  return <><span className="pulse-dot"/>Detecting GPS…</>;
    if (locStatus === 'gps_ok' && location)
      return `📍 ${location.city || 'GPS Location'} (${location.lat.toFixed(4)}, ${location.lon.toFixed(4)})`;
    if (locStatus === 'manual' && location)
      return `📍 ${location.city} (${location.lat.toFixed(4)}, ${location.lon.toFixed(4)})`;
    if (locStatus === 'gps_denied') return '❌ GPS denied — pick your city below';
    return '—';
  };

  return (
    <div className="fw-wrap">
      <div className="fw-card">

        {/* Header */}
        <div className="fw-header">
          <h1>🌾 FarmWise</h1>
          <p>AI-powered crop recommendation for Indian farmers</p>
        </div>

        <div className="fw-body">

          {/* ── Location Panel ── */}
          <div className="loc-panel">
            <div className="loc-header">
              <span className="loc-label">📡 Location</span>
              <button className="loc-refresh" onClick={triggerGPS} disabled={locStatus === 'detecting'}>
                🔄 Retry GPS
              </button>
            </div>

            <div className="loc-status">{locDisplay()}</div>
            {location && (
              <div className="loc-coords">
                Lat {location.lat.toFixed(6)} | Lon {location.lon.toFixed(6)} | via {location.method}
              </div>
            )}

            {/* IP location warning — never auto-use IP */}
            {locStatus === 'gps_denied' && (
              <div className="loc-warning">
                ⚠️ IP-based location is NOT used — it resolves to your ISP's city (e.g. Chennai), not your actual location.
                Please pick your city below for accurate weather data.
              </div>
            )}

            {/* ── City Search ── */}
            {showCitySearch && (
              <div className="city-search-wrap" ref={searchRef}>
                <input
                  className="city-search-input"
                  type="text"
                  placeholder="🔍 Search city (e.g. Sivakasi, Coimbatore…)"
                  value={cityQuery}
                  onChange={e => setCityQuery(e.target.value)}
                  autoFocus
                />
                {cityResults.length > 0 && (
                  <div className="city-dropdown">
                    {cityResults.map(c => (
                      <div key={c.name} className="city-item" onClick={() => handleCityPick(c)}>
                        <span>{c.name}</span>
                        <span className="city-state">{c.state}</span>
                      </div>
                    ))}
                  </div>
                )}
                {cityQuery && cityResults.length === 0 && (
                  <div className="city-dropdown">
                    <div className="city-item" style={{ color: '#6B7280', cursor: 'default' }}>
                      City not found — use manual coordinates below
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Manual Coordinates ── */}
            {(locStatus === 'gps_denied' || locStatus === 'manual') && (
              <div className="manual-wrap">
                <div className="manual-label">Or enter coordinates manually</div>
                <div className="manual-row">
                  <input
                    className="manual-input"
                    type="number"
                    placeholder="Latitude"
                    value={manualLat}
                    onChange={e => { setManualLat(e.target.value); setManualErr(''); }}
                    step="any"
                  />
                  <input
                    className="manual-input"
                    type="number"
                    placeholder="Longitude"
                    value={manualLon}
                    onChange={e => { setManualLon(e.target.value); setManualErr(''); }}
                    step="any"
                  />
                  <button className="manual-btn" onClick={handleManualSubmit}>✓ Set</button>
                </div>
                {manualErr && <div className="field-error" style={{ marginTop: '0.3rem' }}>{manualErr}</div>}
                <div className="map-hint">
                  Find your exact coordinates on{' '}
                  <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a>
                  {' '}→ right-click your location → copy lat/lon.{' '}
                  <strong>Sivakasi: 9.4533, 77.8025</strong>
                </div>
              </div>
            )}

            {/* ── Change city button when location already set ── */}
            {(locStatus === 'gps_ok' || locStatus === 'manual') && !showCitySearch && (
              <button
                type="button"
                className="loc-refresh"
                style={{ marginTop: '0.6rem', fontSize: '0.72rem' }}
                onClick={() => setShowCitySearch(v => !v)}
              >
                🏙 Change City
              </button>
            )}

            {/* ── Weather Preview ── */}
            {weatherLoading && <p className="weather-loading">⏳ Fetching local weather…</p>}
            {weather && !weatherLoading && (
              <div className="weather-strip">
                <div className="weather-chip">
                  <div className="wc-icon">🌡</div>
                  <div className="wc-val">{weather.temperature}°C</div>
                  <div className="wc-lbl">Temp</div>
                </div>
                <div className="weather-chip">
                  <div className="wc-icon">💧</div>
                  <div className="wc-val">{weather.humidity}%</div>
                  <div className="wc-lbl">Humidity</div>
                </div>
                <div className="weather-chip">
                  <div className="wc-icon">🌧</div>
                  <div className="wc-val">{weather.rainfall} mm</div>
                  <div className="wc-lbl">Rain</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Soil Inputs ── */}
          <div className="section-label">🧪 Soil Parameters</div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="fields-grid">
              {FIELDS.map(f => (
                <div className="field-group" key={f.name}>
                  <label className="field-label">
                    {f.icon} {f.label}
                    {f.unit && <span className="field-unit">({f.unit})</span>}
                  </label>
                  <input
                    className={`field-input${errs[f.name] ? ' error' : ''}`}
                    type="number"
                    name={f.name}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={`${f.min}–${f.max}`}
                    step="any"
                  />
                  {errs[f.name] && <span className="field-error">{errs[f.name]}</span>}
                </div>
              ))}
            </div>

            <button className="submit-btn" type="submit" disabled={loading || locStatus === 'detecting'}>
              {loading
                ? <><span className="spinner"/> Predicting…</>
                : '🌾 Predict Best Crop'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}