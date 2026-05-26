// komponent rejestracji - bardzo podobny do Login.jsx, tylko inny endpoint
import React, { useState } from 'react';
import axios from 'axios';

// ten sam regex co w Login.jsx - duplikacja troche slabo, ale dla 2 plikow nie ma sensu kombinowac
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Register({ onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');     // success info "zarejestrowano!"
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!EMAIL_REGEX.test(email)) return 'Podaj prawidłowy adres email.';
    // 6 znakow to minimum z labu, mozna zwiekszyc
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
      // backend hashuje haslo bcryptem zanim wrzuci do bazy
      await axios.post('http://localhost:3000/api/auth/register', { email, password });
      // po sukcesie nie loguje od razu - user sam klika "zaloguj sie"
      setSuccess('Zarejestrowano! Możesz się teraz zalogować.');
    } catch (err) {
      // np. jak email zajety to backend zwroci 400 z odpowiednim komunikatem
      setError(err.response?.data?.error || 'Błąd rejestracji.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-center">
      <section className="card card--sm" aria-labelledby="register-title">
        <header>
          <h1 id="register-title" className="title">🔥 IT Tinder</h1>
          <p className="subtitle">Rejestracja</p>
        </header>

        {/* alerty - dwa rozne kolory dla error i success */}
        {error && <p className="alert-error" role="alert">{error}</p>}
        {success && <p className="alert-success" role="status">{success}</p>}

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <label htmlFor="register-email" className="visually-hidden">Email</label>
          <input
            id="register-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="input"
          />
          <label htmlFor="register-password" className="visually-hidden">Hasło</label>
          <input
            id="register-password"
            type="password"
            placeholder="Hasło (min. 6 znaków)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="input"
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Rejestracja...' : 'Zarejestruj się'}
          </button>
        </form>

        <footer>
          <p className="hint-bottom">
            Masz już konto?{' '}
            <button type="button" onClick={onSwitch} className="link-switch">Zaloguj się</button>
          </p>
        </footer>
      </section>
    </main>
  );
}
