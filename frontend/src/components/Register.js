import React, { useState } from 'react';
export default function Register({ onRegistered, onGoLogin, apiBase }) {
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };
  const handleSubmit = async e => {
    e.preventDefault();
    const { name, email, username, password, confirm } = form;
    if (!name || !email || !username || !password) { setError('All fields are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');
      setSuccess(true);
      setTimeout(() => onRegistered(), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">🌾</span>
          <h2>Create Account</h2>
          <p>Join FarmWise and start farming smarter</p>
        </div>
        {success ? (
          <div className="auth-success">
             Account created! 
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {['name','email','username','password','confirm'].map(field => (
              <div className="form-group" key={field}>
                <label htmlFor={field}>
                  {field === 'confirm' ? 'Confirm Password' : field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  id={field}
                  name={field}
                  type={field === 'password' || field === 'confirm' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={handleChange}
                  placeholder={
                    field === 'name' ? 'Your full name' :
                    field === 'email' ? 'you@example.com' :
                    field === 'username' ? 'Choose a username' :
                    field === 'password' ? 'At least 6 characters' :
                    'Repeat password'
                  }
                  disabled={loading}
                />
              </div>
            ))}
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
        )}
        <p className="auth-switch">
          Already have an account?{' '}
          <button className="link-btn" onClick={onGoLogin}>Sign in</button>
        </p>
      </div>
    </div>
  );
}
