import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import TinderCard from 'react-tinder-card';
import toast, { Toaster } from 'react-hot-toast';
import Login from './Login';
import Register from './Register';
import AdminPanel from './AdminPanel';

const DOSTEPNE_TECHNOLOGIE = [
  'AWS', 'docker', 'git', 'api', 'CSS', 'backend',
  'fullstack', 'go', 'android', 'ios', 'cloud', 'AI/ML',
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [authView, setAuthView] = useState('login');
  const [showAdmin, setShowAdmin] = useState(false);

  const userRole = (() => {
    try { return token ? JSON.parse(atob(token.split('.')[1])).role : null; }
    catch { localStorage.removeItem('token'); return null; }
  })();

  const [jobs, setJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const saved = localStorage.getItem('savedJobs');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileSet, setIsProfileSet] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [noResults, setNoResults] = useState(false);
  const [externalLoading, setExternalLoading] = useState(false);

  const remainingJobs = useMemo(() => jobs.slice().reverse(), [jobs]);
  const childRefs = useMemo(() => remainingJobs.map(() => React.createRef()), [remainingJobs]);

  useEffect(() => { localStorage.setItem('savedJobs', JSON.stringify(savedJobs)); }, [savedJobs]);

  const handleLogin = (newToken) => { localStorage.setItem('token', newToken); setToken(newToken); };
  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); };

  const handleCheckboxChange = (tech) => {
    setSelectedTechs((prev) => prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]);
  };

  const handleStartSearch = async () => {
    if (selectedTechs.length === 0) return;
    setIsLoading(true);
    setNoResults(false);
    try {
      const techQuery = selectedTechs.join(',');
      const res = await axios.get(
        `http://localhost:3000/api/oferty?tech=${encodeURIComponent(techQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.length === 0) { setNoResults(true); setJobs([]); }
      else { setJobs(res.data); setIsProfileSet(true); }
    } catch (err) { console.error('Błąd pobierania ofert:', err); }
    finally { setIsLoading(false); }
  };

  // Lab 14: integracja frontend ↔ zewnętrzne API (Remotive)
  const handleFetchExternal = async () => {
    setExternalLoading(true);
    setNoResults(false);
    try {
      const res = await fetch('http://localhost:3000/api/external/jobs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped = data.map((j) => ({
        id: `ext-${j.id}`,
        title: j.title,
        company: j.company,
        salary_min: 5000,
        salary_max: 12000,
        technologies: j.technologies || [],
        link: j.link,
      }));
      if (mapped.length === 0) {
        setNoResults(true);
      } else {
        setJobs(mapped);
        setIsProfileSet(true);
        toast.success(`Pobrano ${mapped.length} ofert z Remotive`);
      }
    } catch (err) {
      toast.error('Nie udało się pobrać ofert z Remotive API');
    } finally {
      setExternalLoading(false);
    }
  };

  const onSwipe = (direction, job) => {
    if (direction === 'right') {
      setSavedJobs((prev) => [...prev, job]);
      // Zapisz swipe na backendzie tylko dla ofert lokalnych (numeryczne id)
      if (typeof job.id === 'number') {
        fetch('http://localhost:3000/api/swipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ job_id: job.id, status: 'liked' }),
        }).catch(() => {});
      }
      toast(
        (t) => (
          <div className="toast-content">
            <span className="toast-text">Oferta zapisana!</span>
            <a href={job.link} target="_blank" rel="noopener noreferrer"
              className="btn-apply-toast" onClick={() => toast.dismiss(t.id)}>
              Aplikuj teraz
            </a>
          </div>
        ),
        { duration: 5000 }
      );
    }
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
  };

  const handleDeleteOne = (jobId) => { setSavedJobs((prev) => prev.filter((j) => j.id !== jobId)); };
  const handleDeleteAll = () => { setSavedJobs([]); };

  const formatSalary = (min, max) => {
    const f = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return `${f.format(min)} – ${f.format(max)}`;
  };

  // ===== Auth screens =====
  if (!token) {
    return authView === 'login'
      ? <Login onLogin={handleLogin} onSwitch={() => setAuthView('register')} />
      : <Register onSwitch={() => setAuthView('login')} />;
  }

  if (showAdmin && userRole === 'admin') {
    return <AdminPanel token={token} onBack={() => setShowAdmin(false)} />;
  }

  // ===== Profile config screen =====
  if (!isProfileSet) {
    return (
      <main className="page-center">
        <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', padding: '12px 16px' } }} />
        <section className="card" aria-labelledby="profile-title">
          <header>
            <h1 id="profile-title" className="title">🔥 IT Tinder</h1>
            <p className="subtitle subtitle--wide">Konfiguracja profilu</p>
          </header>

          <fieldset className="checkbox-list">
            <legend className="section-label">Wybierz technologie, które Cię interesują:</legend>
            {DOSTEPNE_TECHNOLOGIE.map((tech) => (
              <label key={tech} className="checkbox-item">
                <input type="checkbox" checked={selectedTechs.includes(tech)} onChange={() => handleCheckboxChange(tech)} />
                <span>{tech}</span>
              </label>
            ))}
          </fieldset>

          {noResults && <p className="alert-warning" role="status">Brak ofert dla wybranych kryteriów. Spróbuj innych.</p>}

          <button onClick={handleStartSearch} disabled={selectedTechs.length === 0 || isLoading} className="btn-primary">
            {isLoading ? (
              <span className="spinner">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ładowanie...
              </span>
            ) : 'Rozpocznij szukanie (z bazy)'}
          </button>

          <button
            type="button"
            onClick={handleFetchExternal}
            disabled={externalLoading}
            className="btn-outline btn-external"
          >
            {externalLoading ? 'Pobieranie...' : '🌍 Pobierz oferty z Remotive (zewnętrzne API)'}
          </button>

          {selectedTechs.length === 0 && <p className="hint">Zaznacz przynajmniej jedną technologię (lub pobierz oferty zewnętrzne)</p>}
        </section>
      </main>
    );
  }

  // ===== Main swipe view =====
  return (
    <main className="page-top">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', padding: '12px 16px' } }} />

      <header>
        <h1 className="title title--lg">🔥 IT Tinder</h1>
        <p className="subtitle">Przesuń w prawo, aby zapisać · Przesuń w lewo, aby pominąć</p>
      </header>

      <nav className="header-bar" aria-label="Akcje użytkownika">
        {userRole === 'admin' && (
          <button onClick={() => setShowAdmin(true)} className="btn-admin">🛡️ Admin</button>
        )}
        <button onClick={handleLogout} className="btn-secondary">Wyloguj</button>
      </nav>

      <section className="card-stack" aria-label="Stos ofert pracy">
        {remainingJobs.length > 0 ? (
          remainingJobs.map((job, index) => (
            <TinderCard key={job.id} ref={childRefs[index]} onSwipe={(dir) => onSwipe(dir, job)}
              preventSwipe={['up', 'down']} swipeRequirementType="position" className="swipe-card">
              <article className="job-card">
                <div>
                  <h2 className="job-card__title">{job.title}</h2>
                  <p className="job-card__company">{job.company}</p>
                  <p className="job-card__salary">{formatSalary(job.salary_min, job.salary_max)}</p>
                  <ul className="job-card__tags">
                    {job.technologies.map((tech) => (
                      <li key={tech} className="job-card__tag">{tech}</li>
                    ))}
                  </ul>
                </div>
                <footer className="job-card__footer">
                  <span>Swipe ➡️ aby zapisać</span>
                  <span>⬅️ aby pominąć</span>
                </footer>
              </article>
            </TinderCard>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">🎉</span>
            <p className="empty-state__title">To już wszystkie oferty na dziś!</p>
            <p className="empty-state__text">Masz {savedJobs.length} zapisanych ofert w przeglądarce.</p>
          </div>
        )}
      </section>

      <button onClick={() => setIsModalOpen(true)} className="btn-outline">
        📋 Zapisane oferty ({savedJobs.length})
      </button>

      {isModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
        >
          <section className="modal">
            <header className="modal__header">
              <h2 id="saved-modal-title" className="modal__title">Twoje ulubione oferty</h2>
              <div className="modal__actions">
                {savedJobs.length > 0 && (
                  <button onClick={handleDeleteAll} className="btn-delete-all">Usuń wszystkie</button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="btn-close" aria-label="Zamknij">✕</button>
              </div>
            </header>

            {savedJobs.length > 0 ? (
              <ul className="saved-list">
                {savedJobs.map((job) => (
                  <li key={job.id} className="saved-item">
                    <div className="saved-item__info">
                      <h3 className="saved-item__title">{job.title}</h3>
                      <p className="saved-item__company">{job.company}</p>
                      <p className="saved-item__salary">{formatSalary(job.salary_min, job.salary_max)}</p>
                    </div>
                    <div className="saved-item__actions">
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="btn-apply">Aplikuj</a>
                      <button onClick={() => handleDeleteOne(job.id)} className="btn-remove" title="Usuń ofertę" aria-label="Usuń ofertę">✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <span className="empty-state__icon" aria-hidden="true">💔</span>
                <p className="empty-state__text">Nie masz jeszcze żadnych zapisanych ofert. Przesuwaj karty w prawo!</p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
