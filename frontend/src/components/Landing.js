import React from 'react';
import img1 from './1.jpg';
import img2 from './2.jpg';
import img3 from './3.jpg';
const FEATURES = [
  { icon: '🧬', title: 'Six ML Models', desc: 'Multiple models run together to find the best crop for your soil.' },
  { icon: '📍', title: 'Live Weather', desc: 'Auto-fetches temperature, humidity, and rainfall using your location.' },
  { icon: '🌱', title: 'Fertilizer Plan', desc: 'Detects NPK gaps and gives you a stage-wise fertilizer schedule.' },
  { icon: '🧠', title: 'AI Explanations', desc: 'See exactly which factor drove the crop recommendation.' },
];

const STEPS = [
  { num: '1', title: 'Enter Soil Values', desc: 'Type in your N, P, K, and pH values. Just four numbers.' },
  { num: '2', title: 'AI Does the Work', desc: 'Weather is fetched automatically. Six models run on your data.' },
  { num: '3', title: 'Get Your Results', desc: 'See the best crop, confidence scores, and a fertilizer plan.' },
];

const imgStyle = {
  width: '100%',
  height: 320,
  objectFit: 'cover',
  borderRadius: 16,
  display: 'block',
};

export default function Landing({ onGetStarted }) {
  return (
    <div style={{ fontFamily: 'sans-serif', background: '#f5f5f0', color: '#111', minHeight: '100vh' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #ddd', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <strong style={{ fontSize: 18, color: '#1e6b38' }}>🌾 FarmWise</strong>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="#features" style={{ color: '#555', textDecoration: 'none', fontSize: 14 }}>Features</a>
          <a href="#how" style={{ color: '#555', textDecoration: 'none', fontSize: 14 }}>How It Works</a>
          <button onClick={onGetStarted} style={{ background: '#1e6b38', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      </nav>
      <div style={{ background: '#086a27', color: '#fff', padding: '60px 48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 56, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', maxWidth: 480 }}>
          <h1 style={{ fontSize: 36, fontWeight: 600, marginBottom: 14, lineHeight: 1.25 }}>Grow Smarter. Farm Wiser.</h1>
          <p style={{ fontSize: 16, opacity: 0.8, lineHeight: 1.7, marginBottom: 28 }}>
            Enter your soil values and get an AI crop recommendation with a personalized fertilizer plan — in seconds.
          </p>
          <button onClick={onGetStarted} style={{ background: '#2a8a4a', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>
            Get Started Free →
          </button>
          <div style={{ display: 'flex', gap: 32, marginTop: 36, flexWrap: 'wrap' }}>
            {[['22+', 'Crop Varieties'], ['98%', 'Accuracy'], ['6', 'ML Models'], ['7', 'Inputs']].map(([val, lbl]) => (
              <div key={lbl}>
                <div style={{ fontSize: 26, fontWeight: 700 }}>{val}</div>
                <div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: '1 1 340px', maxWidth: 460 }}>
          <img
            src={img1}
            alt="Farmer in a green crop field"
            style={{ ...imgStyle, boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}
          />
        </div>
      </div>

      <div id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 32px', display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 420 }}>
          <img
            src={img2}
            alt="Close-up of healthy soil and seedlings"
            style={{ ...imgStyle, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
          />
        </div>
        <div style={{ flex: '1 1 320px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Features</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>What FarmWise does for you</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div id="how" style={{ background: '#eaede7', padding: '56px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>How It Works</h2>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>Three simple steps</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {STEPS.map((s) => (
                <div key={s.num} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ background: '#e8f5ec', color: '#1e6b38', fontWeight: 700, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.num}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 300px', maxWidth: 420 }}>
            <img
              src={img3}
              alt="Farmer using a tablet in the field"
              style={{ ...imgStyle, boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
            />
          </div>
        </div>
      </div>
      <div style={{ background: '#1e4a2c', color: '#fff', textAlign: 'center', padding: '48px 24px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 10 }}>Start Growing Smarter Today</h2>
        <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 24 }}>Join farmers and researchers using FarmWise.</p>
        <button onClick={onGetStarted} style={{ background: '#2a8a4a', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>
          Get Started Free →
        </button>
      </div>
      <footer style={{ background: '#fff', borderTop: '1px solid #ddd', textAlign: 'center', padding: 20, fontSize: 14, color: 'grey' }}>
        2026 FarmWise · Karthikeyan | Karthik Rahul | Yuvaraaj
      </footer>
    </div>
  );
}