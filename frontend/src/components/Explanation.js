import React, { useState } from 'react';

const FEATURE_META = {
  N:           {  name: 'Nitrogen',    unit: 'kg/ha', tip: 'Helps plants grow leaves and stems. Higher nitrogen supports leafy crops.' },
  P:           {  name: 'Phosphorus',  unit: 'kg/ha', tip: 'Supports root growth and flowering. Critical for fruiting crops.' },
  K:           {  name: 'Potassium',   unit: 'kg/ha', tip: 'Strengthens the plant and improves resistance to disease.' },
  temperature: {  name: 'Temperature', unit: '°C',    tip: 'Crops have preferred temperature ranges for optimal growth.' },
  humidity:    { name: 'Humidity',    unit: '%',     tip: 'Moisture in the air affects plant water needs and disease risk.' },
  ph:          {  name: 'Soil pH',     unit: '',      tip: 'Soil acidity determines which nutrients plants can absorb.' },
  rainfall:    {  name: 'Rainfall',    unit: 'mm/day',tip: 'Water availability is one of the most important factors for crop selection.' },
};

const IMPORTANCE_LABELS = [
  { min: 80, label: ' Very Influential',  color: '#16a34a' },
  { min: 55, label: ' Influential',        color: '#2563eb' },
  { min: 30, label: ' Moderately Important', color: '#d97706' },
  { min: 0,  label: ' Minor Factor',      color: '#9ca3af' },
];
function getImportanceLabel(pct) {
  return IMPORTANCE_LABELS.find(l => pct >= l.min) || IMPORTANCE_LABELS[3];
}
export default function Explanation({ explanation, rawFeatures }) {
  const [tab, setTab] = useState('importance');
  if (!explanation) return null;
  const { feature_importance, lime } = explanation;
  const maxImp = feature_importance ? Math.max(...feature_importance.map(f => f.importance), 0.01) : 0.01;
  return (
    <div className="card xai-card">
      <h3 className="card-title">Why Was This Crop Recommended?</h3>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'importance' ? 'active' : ''}`} onClick={() => setTab('importance')}>
           Factor Breakdown
        </button>
        <button className={`tab-btn ${tab === 'lime' ? 'active' : ''}`} onClick={() => setTab('lime')}>
           Explanation (XAI)
        </button>
      </div>
      {tab === 'importance' && feature_importance && (
        <div className="fi-section">
          {feature_importance.map((item, i) => {
            const pct = (item.importance / maxImp) * 100;
            const meta = FEATURE_META[item.feature] || { icon: '📌', name: item.label, unit: item.unit, tip: '' };
            const lbl  = getImportanceLabel(pct);
            return (
              <div className="fi-row" key={i}>
                <div className="fi-meta">
                  <span>{meta.icon}</span>
                  <span className="fi-label">{meta.name}</span>
                  <span className="fi-value" style={{ color: '#555', fontSize: '0.8rem' }}>
                    {item.value !== null ? `${item.value}${meta.unit ? ' ' + meta.unit : ''}` : '—'}
                  </span>
                </div>
                <div className="fi-bar-wrap">
                  <div className="fi-bar-bg">
                    <div className="fi-bar-fill" style={{ width: `${pct}%`, background: lbl.color }} />
                  </div>
                  <span className="fi-pct" style={{ color: lbl.color }}>{lbl.label}</span>
                </div>
                {meta.tip && <p className="fi-tip">{meta.tip}</p>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'lime' && lime && (
        <div className="lime-section">
          {lime.map((item, i) => {
            const key = Object.keys(FEATURE_META).find(k => item.factor.toLowerCase().includes(k.toLowerCase()));
            const meta = FEATURE_META[key] || { icon: '📌' };
            return (
              <div className="lime-row" key={i}>
                <div className="lime-factor">
                  <span>{meta.icon}</span>
                  <strong>{item.factor}</strong>
                </div>
                <p className="lime-insight">{item.insight}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
