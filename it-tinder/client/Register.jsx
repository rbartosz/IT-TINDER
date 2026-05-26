import React, { useState } from 'react';
import axios from 'axios';

export default function Register({ onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    setSuccess('');
    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/auth/register', { email, password });
      setSuccess('Zarejestrowano! Możesz się teraz zalogować.');
    } catch (err) {
      setError(err.response?.data?.error || 'Błąd rejestracji.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card card--sm">
        <h1 className="title">🔥 IT Tinder</h1>
        <p className="subtitle">Rejestracja</p>

        {error && <p className="alert-error">{error}</p>}
        {success && <p className="alert-success">{success}</p>}

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
            {loading ? 'Rejestracja...' : 'Zarejestruj się'}
          </button>
        </form>

        <p className="hint-bottom">
          Masz już konto?{' '}
          <button onClick={onSwitch} className="link-switch">Zaloguj się</button>
        </p>
      </div>
    </div>
  );
}
