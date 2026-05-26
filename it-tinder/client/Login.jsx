import React, { useState } from 'react';
import axios from 'axios';

// Walidacja prawdziwym regexem (RFC 5322 uproszczony)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Login({ onLogin, onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!EMAIL_REGEX.test(email)) return 'Podaj prawidłowy adres email.';
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
    <main className="page-center">
      <section className="card card--sm" aria-labelledby="login-title">
        <header>
          <h1 id="login-title" className="title">🔥 IT Tinder</h1>
          <p className="subtitle">Zaloguj się</p>
        </header>

        {error && <p className="alert-error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <label htmlFor="login-email" className="visually-hidden">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="input"
          />
          <label htmlFor="login-password" className="visually-hidden">Hasło</label>
          <input
            id="login-password"
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="current-password"
            className="input"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <footer>
          <p className="hint-bottom">
            Nie masz konta?{' '}
            <button type="button" onClick={onSwitch} className="link-switch">Zarejestruj się</button>
          </p>
        </footer>
      </section>
    </main>
  );
}
