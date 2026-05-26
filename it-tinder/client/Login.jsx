import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ onLogin, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!email.includes('@') || !email.includes('.')) return 'Podaj prawidłowy adres email.';
    if (password.length < 6) return 'Hasło musi mieć co najmniej 6 znaków.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3000/api/auth/login', { email, password });
      onLogin(res.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Błąd logowania.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card card--sm">
        <h1 className="title">🔥 IT Tinder</h1>
        <p className="subtitle">Zaloguj się</p>

        {error && <p className="alert-error">{error}</p>}

        <form onSubmit={handleSubmit} className="form-stack">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
          <input
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <p className="hint-bottom">
          Nie masz konta?{' '}
          <button onClick={onSwitch} className="link-switch">Zarejestruj się</button>
        </p>
      </div>
    </div>
  );
}
