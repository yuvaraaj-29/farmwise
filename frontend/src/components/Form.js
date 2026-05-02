import React, { useState, useEffect } from 'react';

const FIELDS = [
  { name: 'N', label: 'Nitrogen (N)', min: 0, max: 140 },
  { name: 'P', label: 'Phosphorus (P)', min: 5, max: 145 },
  { name: 'K', label: 'Potassium (K)', min: 5, max: 205 },
  { name: 'ph', label: 'Soil pH', min: 3.5, max: 9.9 },
];

// ---------------- VALIDATION ----------------
function validate(form) {
  const errs = {};
  FIELDS.forEach(f => {
    const v = parseFloat(form[f.name]);
    if (form[f.name] === '') errs[f.name] = 'Required';
    else if (isNaN(v)) errs[f.name] = 'Invalid number';
    else if (v < f.min || v > f.max) errs[f.name] = `Range ${f.min}-${f.max}`;
  });
  return errs;
}

// ---------------- WEATHER API ----------------
async function fetchWeather(lat, lon) {
  const weatherKey = process.env.REACT_APP_WEATHER_API_KEY;
  const openKey = process.env.REACT_APP_OPEN_API_KEY;

  // WeatherAPI
  try {
    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${weatherKey}&q=${lat},${lon}`
    );

    const data = await res.json();
    if (!res.ok) throw new Error("WeatherAPI failed");

    return {
      temperature: data.current.temp_c,
      humidity: data.current.humidity,
      rainfall: data.current.precip_mm || 0,
      source: "WeatherAPI"
    };
  } catch (e) {
    console.warn("WeatherAPI failed:", e.message);
  }

  // OpenWeather fallback
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openKey}&units=metric`
    );

    const data = await res.json();
    if (!res.ok) throw new Error("OpenWeather failed");

    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      rainfall: data.rain?.["1h"] || 0,
      source: "OpenWeather"
    };
  } catch (e) {
    console.warn("OpenWeather failed:", e.message);
  }

  throw new Error("Weather fetch failed");
}

// ---------------- GPS LOCATION ----------------
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject("No GPS");

    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          method: "GPS"
        });
      },
      reject,
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

// ---------------- IP FALLBACK ----------------
async function getIPLocation() {
  // Try multiple free providers in order — ipapi.co rate-limits to ~45 req/hour
  const providers = [
    async () => {
      const res = await fetch('https://ipapi.co/json/');
      const d = await res.json();
      if (!d.latitude) throw new Error('no coords');
      return { lat: d.latitude, lon: d.longitude, city: d.city || '' };
    },
    async () => {
      const res = await fetch('https://ip-api.com/json/?fields=lat,lon,city,status');
      const d = await res.json();
      if (d.status !== 'success') throw new Error('failed');
      return { lat: d.lat, lon: d.lon, city: d.city || '' };
    },
    async () => {
      const res = await fetch('https://freeipapi.com/api/json');
      const d = await res.json();
      if (!d.latitude) throw new Error('no coords');
      return { lat: d.latitude, lon: d.longitude, city: d.cityName || '' };
    },
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      return { ...result, method: 'IP' };
    } catch {
      // try next provider
    }
  }
  return null;
}

// ---------------- MAIN COMPONENT ----------------
export default function Form({ onPredict, loading }) {
  const [form, setForm] = useState({ N: '', P: '', K: '', ph: '' });
  const [errs, setErrs] = useState({});

  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [locCity, setLocCity] = useState('');

  const [locStatus, setLocStatus] = useState("idle");
  const [locMethod, setLocMethod] = useState("");

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    detectLocation();
  }, []);

  // ---------------- WEATHER ----------------
  const loadWeather = async (lt, ln) => {
    setWeatherLoading(true);
    try {
      setWeather(await fetchWeather(lt, ln));
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  // ---------------- LOCATION FLOW ----------------
  const detectLocation = async () => {
    setLocStatus("detecting");
    setWeather(null);

    // 1️⃣ Try GPS first
    try {
      const gps = await getGPS();
      setLat(gps.lat);
      setLon(gps.lon);
      setLocMethod("GPS");
      setLocStatus("detected");
      setLocCity('');  // city will appear in ResultCard via backend reverse-geocode
      loadWeather(gps.lat, gps.lon);
      return;
    } catch {
      console.warn("GPS failed → trying IP");
    }

    // 2️⃣ Fallback IP
    const ip = await getIPLocation();

    if (ip) {
      setLat(ip.lat);
      setLon(ip.lon);
      setLocMethod("IP");
      setLocCity(ip.city || '');
      setLocStatus("detected");
      loadWeather(ip.lat, ip.lon);
    } else {
      setLocStatus("denied");
    }
  };

  // ---------------- INPUT ----------------
  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrs({});
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = e => {
    e.preventDefault();

    const errors = validate(form);
    if (Object.keys(errors).length) return setErrs(errors);

    onPredict({
      N: +form.N,
      P: +form.P,
      K: +form.K,
      ph: +form.ph,
      lat,
      lon
    });
  };

  // ---------------- UI STATUS ----------------
  const locationText =
    locStatus === "detecting"
      ? "📡 Detecting location..."
      : locStatus === "detected"
      ? `📍 ${locMethod}: ${locCity ? locCity + ' ' : ''}(${lat?.toFixed(4)}, ${lon?.toFixed(4)})`
      : "❌ Location unavailable — weather will use regional averages";

  return (
    <div className="form-wrapper">

      <div className="card">

        <h2>🌱 FarmWise Crop Predictor</h2>

        {/* LOCATION */}
        <div className="location-box">
          <p>{locationText}</p>
          <button type="button" onClick={detectLocation}>
            🔄 Refresh Location
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit}>
          {FIELDS.map(f => (
            <div key={f.name}>
              <label>{f.label}</label>
              <input
                type="number"
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
              />
              {errs[f.name] && <small style={{ color: "red" }}>{errs[f.name]}</small>}
            </div>
          ))}

          <button disabled={loading}>
            {loading ? "Predicting..." : "🌾 Predict Crop"}
          </button>
        </form>

        {/* WEATHER */}
        {weather && (
          <div className="weather-box">
            <p>🌡 Temp: {weather.temperature}°C</p>
            <p>💧 Humidity: {weather.humidity}%</p>
            <p>🌧 Rain: {weather.rainfall} mm</p>
            <p>📡 Source: {weather.source}</p>
          </div>
        )}

        {weatherLoading && <p>Loading weather...</p>}

      </div>

    </div>
  );
}