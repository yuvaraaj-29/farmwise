import React, { useState } from 'react';
const STAGE_LABELS = {
  basal: { label: 'Basal Application' },
  active_tillering: { label: 'Active Tillering' },
  panicle_initiation: { label: 'Panicle Initiation' },
  vegetative: { label: 'Vegetative Stage' },
  pre_flowering: { label: 'Pre-Flowering' },
  square_formation: { label: 'Square Formation' },
};
function StageCard({ stage, index, isLast }) {
  const [expanded, setExpanded] = useState(index === 0);
  const stageInfo = STAGE_LABELS[stage.stage] || { 
    label: stage.stage 
  };
  const displayDay = stage.day + 1;
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '15px' }}>
        <div style={{ textAlign: 'center', minWidth: '50px' }}>
          <div style={{
            width: '35px',
            height: '35px',
            backgroundColor: '#16a34a',
            color: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            D{displayDay}
          </div>
          {!isLast && (
            <div style={{ 
              width: '3px', 
              height: '40px', 
              backgroundColor: '#ddd', 
              margin: '5px auto 0' 
            }} />
          )}
        </div>
        <div style={{
          flex: 1,
          border: '1px solid #ccc',
          borderRadius: '8px',
          backgroundColor: 'white',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%',
              padding: '15px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {stageInfo.label}
                </div>
                <div style={{ fontSize: '14px', color: '#555' }}>
                  Day {displayDay} — {stage.description}
                </div>
              </div>
            </div>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 'bold',
              color: '#666',
              lineHeight: '1'
            }}>
              {expanded ? '−' : '+'}
            </span>
          </button>
          {expanded && (
            <div style={{ padding: '0 15px 15px 15px' }}>
              {stage.fertilizers.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 0',
                    borderBottom: i < stage.fertilizers.length - 1 ? '1px solid #eee' : 'none'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: '15px', marginTop: '4px' }}>
                    {f.adjusted_qty} {f.unit}
                  </div>
                </div>
              ))}

              {stage.reasons && stage.reasons.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                    Why these quantities?
                  </div>
                  <ul style={{ paddingLeft: '20px', margin: '5px 0', color: '#444' }}>
                    {stage.reasons.map((r, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FertilizerSchedule({ fertilizer }) {
  if (!fertilizer || !fertilizer.available) {
    return (
      <div style={{ 
        padding: '30px', 
        textAlign: 'center', 
        backgroundColor: '#f9f9f9', 
        borderRadius: '8px',
        border: '1px dashed #ccc',
        color: '#666'
      }}>
        No fertilizer schedule available for this crop yet.
      </div>
    );
  }

  const { crop, crop_duration_days, fertilizer_plan } = fertilizer;

  return (
    <div style={{ padding:'10px',backgroundColor:'white',fontFamily: 'sans-serif', maxWidth: '900px', margin: 'auto', border:'1px solid var(--border)',borderRadius:'15px'}}>
      <h2 style={{ margin: '0 0 8px 0' }}>Fertilizer Schedule</h2>
      <p style={{ color: '#777474', marginBottom: '20px' }}>
        {crop.charAt(0).toUpperCase() + crop.slice(1)} — {crop_duration_days} days
      </p>
      {fertilizer_plan.map((stage, i) => (
        <StageCard
          key={i}
          stage={stage}
          index={i}
          isLast={i === fertilizer_plan.length - 1}
        />
      ))}
    </div>
  );
}