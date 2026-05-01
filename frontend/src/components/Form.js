import React, { useState, useEffect } from 'react';

const FIELDS = [
  { name: 'N',  label: 'Nitrogen (N)',   unit: 'kg/ha', min: 0,   max: 140, step: 1,   placeholder: '0 – 140',   hint: 'Macronutrient for leaf and stem growth' },
  { name: 'P',  label: 'Phosphorus (P)', unit: 'kg/ha', min: 5,   max: 145, step: 1,   placeholder: '5 – 145',   hint: 'Supports root development and flowering' },
  { name: 'K',  label: 'Potassium (K)',  unit: 'kg/ha', min: 5,   max: 205, step: 1,   placeholder: '5 – 205',   hint: 'Enhances disease resistance and quality' },
  { name: 'ph', label: 'Soil pH',        unit: '',      min: 3.5, max: 9.9, step: 0.1, placeholder: '3.5 – 9.9', hint: 'Optimal range: 5.5 – 7.5 for most crops' },
];
function validate(form) {
  const errs = {};
  FIELDS.forEach(f => {
    const v = parseFloat(form[f.name]);
    if (form[f.name] === '') { errs[f.name] = 'Required'; return; }
    if (isNaN(v))            { errs[f.name] = 'Must be a number'; return; }
    if (v < f.min || v > f.max) errs[f.name] = `Between ${f.min} and ${f.max}`;
  });
  return errs;
}
async function fetchWeather(lat, lon) {
  const weatherApiKey = process.env.REACT_APP_WEATHER_API_KEY;
  const openWeatherApiKey = process.env.REACT_APP_OPEN_API_KEY;

  console.log("WeatherAPI KEY:", weatherApiKey);
  console.log("OpenWeather KEY:", openWeatherApiKey);

  // --- Primary: WeatherAPI ---
  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${lat},${lon}`;
    const res = await fetch(url);

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`WeatherAPI failed: ${errData}`);
    }

    const data = await res.json();

    return {
      temperature: data.current?.temp_c ?? null,
      humidity: data.current?.humidity ?? null,
      rainfall: data.current?.precip_mm ?? 0,
    };
  } catch (err) {
    console.error("WeatherAPI error:", err.message);
  }

  // --- Fallback: OpenWeather ---
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=metric`;
    const res = await fetch(url);

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`OpenWeather failed: ${errData}`);
    }

    const data = await res.json();

    return {
      temperature: data.main?.temp ?? null,
      humidity: data.main?.humidity ?? null,
      rainfall: data.rain?.["1h"] ?? 0,
    };
  } catch (err) {
    console.error("OpenWeather error:", err.message);
  }

  throw new Error("Both weather APIs failed");
}
async function fetchLocation() {
  const weatherApiKey = process.env.REACT_APP_WEATHER_API_KEY;

  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=auto`;
    const res = await fetch(url);

    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`Location fetch failed: ${errData}`);
    }

    const data = await res.json();
    const loc = data.location;

    return {
      lat: loc.lat,
      lon: loc.lon,
      city: loc.name || loc.region || loc.country || "Unknown",
      method: "weatherapi",
    };
  } catch (err) {
    console.error("Location error:", err.message);
    return null;
  }
}
export default function Form({ onPredict, loading }) {
  const [form, setForm]                   = useState({ N: '', P: '', K: '', ph: '' });
  const [errs, setErrs]                   = useState({});
  const [lat, setLat]                     = useState(null);
  const [lon, setLon]                     = useState(null);
  const [city, setCity]                   = useState('');
  const [locStatus, setLocStatus]         = useState('idle');
  const [locMethod, setLocMethod]         = useState('');
  const [weather, setWeather]             = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  useEffect(() => { detectLocation(); }, []);
  const loadWeather = async (lt, ln) => {
    setWeatherLoading(true);
    try { setWeather(await fetchWeather(lt, ln)); }
    catch (_) { setWeather(null); }
    finally { setWeatherLoading(false); }
  };
  const applyLocation = async (locationData) => {
    setLat(locationData.lat); setLon(locationData.lon); setLocMethod(locationData.method); setLocStatus('detected');
    setCity(locationData.city);
    loadWeather(locationData.lat, locationData.lon);
  };
  const detectLocation = async () => {
    setLocStatus('detecting'); setWeather(null); setCity('');
    const locData = await fetchLocation();
    if (locData) {
      applyLocation(locData);
    } else {
      setLocStatus('denied');
    }
  };

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrs(er => ({ ...er, [e.target.name]: '' }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length) { setErrs(errors); return; }
    onPredict({ N: parseFloat(form.N), P: parseFloat(form.P), K: parseFloat(form.K), ph: parseFloat(form.ph), lat: lat || null, lon: lon || null });
  };

  const locLabel = () => {
    if (locStatus === 'idle')         return { text: 'Location not yet detected', cls: 'loc-idle' };
    if (locStatus === 'detecting')    return { text: 'Detecting location via WeatherAPI…', cls: 'loc-wait' };
    if (locStatus === 'detected') {
      const coordStr = `${lat?.toFixed(3)}°, ${lon?.toFixed(3)}°`;
      const label = city || coordStr;
      return { text: `🌐 WeatherAPI: ${label}`, cls: 'loc-ok' };
    }
    return { text: 'WeatherAPI unavailable. Using default location.', cls: 'loc-warn' };
  };

  const { text: locText, cls: locCls } = locLabel();
  const isDetecting = locStatus === 'detecting';

  return (
    <div className="form-wrapper">
      <div className="card form-card">
        <div className="form-header">
          <h2 className="card-title">Soil Parameters</h2>
          <p className="card-sub">Enter your soil test values. Weather data is fetched automatically from your location.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {FIELDS.map(f => (
              <div className={`form-group ${errs[f.name] ? 'has-error' : ''}`} key={f.name}>
                <label htmlFor={f.name}>
                  {f.label}
                  {f.unit && <span className="unit-badge">{f.unit}</span>}
                </label>
                <input
                  id={f.name} type="number" name={f.name}
                  value={form[f.name]} onChange={handleChange}
                  placeholder={f.placeholder} min={f.min} max={f.max} step={f.step}
                  disabled={loading}
                />
                {errs[f.name]
                  ? <span className="field-error">⚠ {errs[f.name]}</span>
                  : <span className="field-hint">{f.hint}</span>}
              </div>
            ))}
          </div>

          <div className="location-weather-panel">
            <div className="location-row">
              <span className={`loc-text ${locCls}`}>{locText}</span>
              <button type="button" className="btn-retry" onClick={detectLocation}
                disabled={loading || isDetecting}>
                {isDetecting ? '…' : 'Refresh'}
              </button>
            </div>

            {weatherLoading && (
              <div className="weather-loading"><span className="spinner-small" /> Fetching live weather…</div>
            )}

            {weather && !weatherLoading && (
              <div className="weather-strip">
                <div className="w-chip">
                  <span className="w-chip-val">{weather.temperature !== null ? `${weather.temperature}°C` : '—'}</span>
                  <span className="w-chip-lbl">Temperature</span>
                </div>
                <div className="w-chip">
                  <span className="w-chip-val">{weather.humidity !== null ? `${weather.humidity}%` : '—'}</span>
                  <span className="w-chip-lbl">Humidity</span>
                </div>
                <div className="w-chip">
                  <span className="w-chip-val">{weather.rainfall !== null ? `${weather.rainfall} mm` : '—'}</span>
                  <span className="w-chip-lbl">Rainfall</span>
                </div>
              </div>
            )}

            {locStatus === 'denied' && !weather && (
              <p className="loc-fallback-note">Unable to fetch live weather. Regional defaults will be used for prediction.</p>
            )}
          </div>

          <button type="submit" className="btn-predict" disabled={loading}>
            {loading ? 'Analysing…' : ' Predict Best Crop'}
          </button>
        </form>
      </div>

      <div className="form-sidebar">
        <div className="sidebar-tip-card">
          <h4> How to read your soil test</h4>
          <ul>
            <li><strong>N (Nitrogen):</strong> From soil test report, kg/ha</li>
            <li><strong>P (Phosphorus):</strong> Available P in soil, kg/ha</li>
            <li><strong>K (Potassium):</strong> Exchangeable K, kg/ha</li>
            <li><strong>pH:</strong> Measure with a pH meter or test kit</li>
          </ul>
        </div>
        <div className="sidebar-tip-card">
          <h4> Live weather auto-detected</h4>
          <p>Location detected via WeatherAPI IP lookup. Weather data fetched from WeatherAPI or OpenWeatherMap — API keys required.</p>
        </div>
      </div>
    </div>
  );
}