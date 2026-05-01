import React from 'react';

const CROP_EMOJI = {
  rice:'🌾', wheat:'🌾', maize:'🌽', cotton:'🌿', sugarcane:'🎋',
  banana:'🍌', mango:'🥭', apple:'🍎', grapes:'🍇', potato:'🥔',
  tomato:'🍅', coconut:'🥥', coffee:'☕', chickpea:'🫘', lentil:'🫘',
  kidneybeans:'🫘', pigeonpeas:'🫘', mothbeans:'🫘', mungbean:'🫘',
  blackgram:'🫘', pomegranate:'🍎', orange:'🍊', papaya:'🥭',
  watermelon:'🍉', muskmelon:'🍈', jute:'🌿',
};
export default function ResultCard({ data }) {
  const { crop, confidence, confidence_tier, top_crops, weather } = data;
  const emoji = CROP_EMOJI[crop?.toLowerCase()] || '🌱';
  const tierColor = {
    'Very High': '#0a100c',
    'High':      '#161d2d',
    'Medium':    '#1e170f',
    'Low':       '#1e0b0b',
    'Very Low':  '#1f0909',
  }[confidence_tier] || '#070b13';
  return (
    <div className="card result-card">
      <h3 className="card-title">Recommended Crop</h3>
      <div className="crop-hero">
        <span className="crop-emoji-big">{emoji}</span>
        <div>
          <h2 className="crop-name">{crop?.toUpperCase()}</h2>
          <span className="confidence-label" style={{ color: tierColor }}>
            {confidence_tier} Confidence ({confidence.toFixed(0)}%)
          </span>
        </div>
      </div>
      <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>Current Weather at Your Location</h4>
      <p style={{ marginBottom: '0.8rem', fontSize: '0.95rem', opacity: 0.8 }}>
  📍 {data.location?.city || `${data.location?.lat}, ${data.location?.lon}`}
      </p>
      <div className="weather-row">
        <div className="w-item">
          <span className="w-val">{weather.temperature}°C </span>
          <span className="w-lbl"> Temperature</span>
        </div>
        <div className="w-item">
          <span className="w-val">{weather.humidity}% </span>
          <span className="w-lbl">Humidity</span>
        </div>
        <div className="w-item">
          <span className="w-val">{weather.rainfall} mm </span>
          <span className="w-lbl">Rainfall</span>
        </div>
      </div>
      {top_crops && top_crops.length > 1 && (
        <div className="alternatives">
          <h4>Other Crops That Could Work</h4>
          {top_crops.slice(1, 4).map((item, i) => (
            <div className="alt-row" key={i}>
              <span>{CROP_EMOJI[item.crop] || '🌱'} {item.crop}</span>
              <div className="alt-bar-bg">
                <div className="alt-bar" style={{ width: `${item.probability}%` }} />
              </div>
              <span className="alt-pct">{item.probability.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
