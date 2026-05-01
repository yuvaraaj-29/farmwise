import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import Landing from './components/Landing';
import Login from './components/Login';
import Register from './components/Register';
import Form from './components/Form';
import ResultCard from './components/ResultCard';
import Explanation from './components/Explanation';
import FertilizerPanel from './components/FertilizerPanel';
const API = `https://farmwise-vsm6.onrender.com/api`;

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, delay = 0 }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const token    = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const name     = localStorage.getItem('name');
    return token && username ? { token, username, name: name || username } : null;
  });
  const [page, setPage] = useState(() => {
    const token    = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    return token && username ? 'app' : 'landing';
  });

  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [section, setSection] = useState('form');
  const resultTopRef = useRef(null);
  const handleLogin = useCallback((userData) => {
    setUser(userData);
    setPage('app');
    setSection('form');
  }, []);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const handleLogout = useCallback(() => setShowLogoutModal(true), []);
  const confirmLogout = useCallback(() => {
    setShowLogoutModal(false);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('name');
    setUser(null);
    setResult(null);
    setSection('form');
    setError('');
    setPage('landing');
  }, []);

  const handlePredict = useCallback(async (payload) => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      console.log(`[FarmWise] Sending prediction request for Location: ${payload.lat}, ${payload.lon}`);

      // Ensure coordinates are present. If missing, the ML service defaults to Central India.
      if (!payload.lat || !payload.lon) {
        console.warn("[FarmWise] Geolocation missing in payload. Prediction may use fallback weather data.");
      }

      const res  = await fetch(`${API}/predict`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prediction failed.');
      setResult(data);
      setSection('result');
      setTimeout(() => {
        resultTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err) {
      setError(err.message || 'Cannot reach backend. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }
  }, []);
  if (page === 'landing') return <Landing onGetStarted={() => setPage('login')} />;
  if (page === 'register') {
    return (
      <Register
        onRegistered={() => setPage('login')}
        onGoLogin={() => setPage('login')}
        apiBase={API}
      />
    );
  }
  if (!user || page === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onGoRegister={() => setPage('register')}
        apiBase={API}
      />
    );
  }
  const NAV_SECTIONS = [
    { key: 'form',   label: '🌱 Soil Input' },
    { key: 'result', label: '📊 Results',   disabled: !result },
  ];
  return (
    <div className="app app-with-bg">
      {showLogoutModal && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal" onClick={e => e.stopPropagation()}>
            <div className="logout-modal-icon">🌾</div>
            <h3>Sign Out?</h3>
            <p>Are you sure you want to sign out of FarmWise?</p>
            <div className="logout-modal-actions">
              <button className="btn-logout-cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="btn-logout-confirm" onClick={confirmLogout}>Yes, Sign Out</button>
            </div>
          </div>
        </div>
      )}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🌾</span>
            <div>
              <h1>FarmWise</h1>
              <p>AI-Powered Crop Intelligence</p>
            </div>
          </div>
          <nav className="nav-pills">
            {NAV_SECTIONS.map(sec => (
              <button
                key={sec.key}
                className={`nav-pill ${section === sec.key ? 'active' : ''}`}
                onClick={() => setSection(sec.key)}
                disabled={sec.disabled}
              >
                {sec.label}
              </button>
            ))}
          </nav>
          <div className="user-area">
            <div className="user-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
            <span className="user-name">{user.name}</span>
            <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </header>
      <main className="main">
        {error && (
          <div className="error-banner">
            <span> {error}</span>
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="leaf-spinner">🌿</div>
              <div className="loading-text">
                <h3>Analysing your soil data…</h3>
                <p>Fetching live weather · Running ML models · Generating fertilizer plan</p>
              </div>
            </div>
          </div>
        )}
        {section === 'form' && !loading && (
          <Form onPredict={handlePredict} loading={loading} />
        )}
        {section === 'result' && result && !loading && (
          <div ref={resultTopRef} style={{ maxWidth: '860px', margin: '0 auto', padding: '0 1rem' }}>
            <RevealSection delay={0}>
              <ResultCard data={result} />
            </RevealSection>
            <RevealSection delay={80}>
              <div style={{ marginTop: '1.5rem' }}>
                <Explanation
                  explanation={result.explanation}
                  rawFeatures={result.input_features}
                />
              </div>
            </RevealSection>
            {result.fertilizer && (
              <RevealSection delay={160}>
                <div style={{ marginTop: '1.5rem' }}>
                  <FertilizerPanel fertilizer={result.fertilizer} />
                </div>
              </RevealSection>
            )}

          </div>
        )}
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-logo">🌾 FarmWise</span>
          <span>Explainable AI · Live Weather · Smart Fertilizer Planning</span>
          <span>© 2026 FarmWise</span>
        </div>
      </footer>
    </div>
  );
}
export default App;
