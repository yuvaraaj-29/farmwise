import React, { useState, useEffect } from 'react';

const FIELDS = [
  { name: 'N', label: 'Nitrogen (N)', unit: 'kg/ha', min: 0, max: 140, step: 1, placeholder: '0 – 140', hint: 'Macronutrient for leaf and stem growth' },
  { name: 'P', label: 'Phosphorus (P)', unit: 'kg/ha', min: 5, max: 145, step: 1, placeholder: '5 – 145', hint: 'Supports root development and flowering' },
  { name: 'K', label: 'Potassium (K)', unit: 'kg/ha', min: 5, max: 205, step: 1, placeholder: '5 – 205', hint: 'Enhances disease resistance and quality' },
  { name: 'ph', label: 'Soil pH', unit: '', min: 3.5, max: 9.9, step: 0.1, placeholder: '3.5 – 9.9', hint: 'Optimal range: 5.5 – 7.5 for most crops' },
];

function validate(form) {
  const errs = {};
  FIELDS.forEach(f => {
    const v = parseFloat(form[f.name]);
    if (form[f.name] === '') { errs[f.name] = 'Required'; return; }
    if (isNaN(v)) { errs[f.name] = 'Must be a number'; return; }
    if (v < f.min || v > f.max) errs[f.name] = `Between ${f.min} and ${f.max}`;
  });
  return errs;
}

/* ================= WEATHER ================= */

async function fetchWeather(lat, lon) {
  const weatherApiKey = process.env.REACT_APP_WEATHER_API_KEY;
  const openWeatherApiKey = process.env.REACT_APP_OPEN_API_KEY;

  console.log("WeatherAPI KEY:", weatherApiKey);

  // --- WeatherAPI ---
  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${lat},${lon}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error("WeatherAPI failed");

    const data = await res.json();

    return {
      temperature: data.current?.temp_c ?? null,
      humidity: data.current?.humidity ?? null,
      rainfall: data.current?.precip_mm ?? 0,
    };
  } catch (err) {
    console.log("WeatherAPI error:", err.message);
  }

  // --- OpenWeather fallback ---
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=metric`;
    const res = await fetch(url);

    if (!res.ok) throw new Error("OpenWeather failed");

    const data = await res.json();

    return {
      temperature: data.main?.temp ?? null,
      humidity: data.main?.humidity ?? null,
      rainfall: data.rain?.['1h'] ?? 0,
    };
  } catch (err) {
    console.log("OpenWeather error:", err.message);
  }

  throw new Error('Weather fetch failed');
}

/* ================= LOCATION ================= */

async function fetchLocation() {
  try {
    const res = await fetch('https://ipapi.co/json/'); // FREE + no key
    if (!res.ok) throw new Error("Location fetch failed");

    const data = await res.json();

    return {
      lat: data.latitude,
      lon: data.longitude,
      city: data.city || 'Unknown',
      method: 'ipapi'
    };
  } catch (err) {
    console.log("Location error:", err.message);
    return null;
  }
}

/* ================= COMPONENT ================= */

export default function Form({ onPredict, loading }) {
  const [form, setForm] = useState({ N: '', P: '', K: '', ph: '' });
  const [errs, setErrs] = useState({});
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [city, setCity] = useState('');
  const [locStatus, setLocStatus] = useState('idle');
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => { detectLocation(); }, []);

  const loadWeather = async (lt, ln) => {
    setWeatherLoading(true);
    try {
      const data = await fetchWeather(lt, ln);
      setWeather(data);
    } catch (err) {
      console.log(err.message);
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const detectLocation = async () => {
    setLocStatus('detecting');
    const locData = await fetchLocation();

    if (locData) {
      setLat(locData.lat);
      setLon(locData.lon);
      setCity(locData.city);
      setLocStatus('detected');
      loadWeather(locData.lat, locData.lon);
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

    onPredict({
      N: +form.N,
      P: +form.P,
      K: +form.K,
      ph: +form.ph,
      lat,
      lon
    });
  };

  return (
    <div>
      <h2>Soil Input</h2>

      {locStatus === 'detecting' && <p>Detecting location...</p>}
      {locStatus === 'detected' && <p>📍 {city}</p>}
      {locStatus === 'denied' && <p>⚠ Location unavailable</p>}

      {weatherLoading && <p>Loading weather...</p>}

      {weather && (
        <div>
          <p>🌡 Temp: {weather.temperature}°C</p>
          <p>💧 Humidity: {weather.humidity}%</p>
          <p>🌧 Rain: {weather.rainfall} mm</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {FIELDS.map(f => (
          <input
            key={f.name}
            name={f.name}
            value={form[f.name]}
            onChange={handleChange}
            placeholder={f.label}
          />
        ))}
        <button type="submit">Predict</button>
      </form>
    </div>
  );
}