// glowny komponent aplikacji - po zalogowaniu od razu swipowanie z filtrami
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

  const [allJobs, setAllJobs] = useState([]);             // wszystkie oferty z API
  const [swipedIds, setSwipedIds] = useState(new Set());  // id ofert juz swipowanych
  const [savedJobs, setSavedJobs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('savedJobs')) || []; }
    catch { return []; }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // filtry
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [salaryMin, setSalaryMin] = useState(0);
  const [salaryMax, setSalaryMax] = useState(50000);

  // po zalogowaniu od razu pobierz wszystkie oferty z bazy
  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    axios.get('http://localhost:3000/api/jobs', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setAllJobs(res.data))
      .catch(err => console.error('Blad pobierania ofert:', err))
      .finally(() => setIsLoading(false));
  }, [token]);

  // filtrowanie ofert na biezaco (bez swipowanych)
  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => {
      if (swipedIds.has(job.id)) return false;
      // filtr technologii - jesli cos zaznaczone, oferta musi miec przynajmniej jeden tag
      if (selectedTechs.length > 0) {
        const jobTechs = (job.technologies || []).map(t => t.toLowerCase());
        if (!selectedTechs.some(t => jobTechs.includes(t.toLowerCase()))) return false;
      }
      // filtr wynagrodzenia
      if (job.salary_min != null && job.salary_max != null) {
        if (job.salary_max < salaryMin || job.salary_min > salaryMax) return false;
      }
      return true;
    });
  }, [allJobs, swipedIds, selectedTechs, salaryMin, salaryMax]);

  const remainingJobs = useMemo(() => filteredJobs.slice().reverse(), [filteredJobs]);
  const childRefs = useMemo(() => remainingJobs.map(() => React.createRef()), [remainingJobs]);

  useEffect(() => { localStorage.setItem('savedJobs', JSON.stringify(savedJobs)); }, [savedJobs]);

  const handleLogin = (newToken) => { localStorage.setItem('token', newToken); setToken(newToken); };
  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); };

  const handleCheckboxChange = (tech) => {
    setSelectedTechs(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]);
  };

  const onSwipe = (direction, job) => {
    setSwipedIds(prev => new Set(prev).add(job.id));
    if (direction === 'right') {
      setSavedJobs(prev => [...prev, job]);
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
  };

  const handleDeleteOne = (jobId) => { setSavedJobs(prev => prev.filter(j => j.id !== jobId)); };
  const handleDeleteAll = () => { setSavedJobs([]); };

  const formatSalary = (min, max) => {
    if (min == null || max == null) return 'Brak danych';
    const f = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return `${f.format(min)} – ${f.format(max)}`;
  };

  // ===== logowanie =====
  if (!token) {
    return authView === 'login'
      ? <Login onLogin={handleLogin} onSwitch={() => setAuthView('register')} />
      : <Register onSwitch={() => setAuthView('login')} />;
  }

  if (showAdmin && userRole === 'admin') {
    return <AdminPanel token={token} onBack={() => setShowAdmin(false)} />;
  }

  // ===== glowny widok: filtry + karty =====
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

      <div className="main-layout">
        {/* przycisk toggle filtrow */}
        <button onClick={() => setFiltersOpen(prev => !prev)} className="btn-filters-toggle">
          🔍 Filtry {selectedTechs.length > 0 && `(${selectedTechs.length})`}
        </button>

        {/* wysuwany panel filtrow */}
        {filtersOpen && (
          <aside className="filter-panel filter-panel--overlay">
            <h2 className="filter-panel__title">Filtry</h2>

            <fieldset className="filter-section">
              <legend className="filter-section__label">Technologie</legend>
              {DOSTEPNE_TECHNOLOGIE.map(tech => (
                <label key={tech} className="checkbox-item checkbox-item--small">
                  <input type="checkbox" checked={selectedTechs.includes(tech)} onChange={() => handleCheckboxChange(tech)} />
                  <span>{tech}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="filter-section">
              <legend className="filter-section__label">Wynagrodzenie (PLN/mies.)</legend>
              <div className="salary-inputs">
                <label className="salary-field">
                  <span>Od</span>
                  <input type="number" value={salaryMin} onChange={e => setSalaryMin(Number(e.target.value))} min={0} step={1000} />
                </label>
                <label className="salary-field">
                  <span>Do</span>
                  <input type="number" value={salaryMax} onChange={e => setSalaryMax(Number(e.target.value))} min={0} step={1000} />
                </label>
              </div>
            </fieldset>

            <p className="filter-panel__count">Pasujących ofert: {filteredJobs.length}</p>
          </aside>
        )}

        {/* stos kart */}
        <section className="card-stack" aria-label="Stos ofert pracy">
          {isLoading ? (
            <div className="empty-state">
              <span className="spinner spinner--large">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
              <p className="empty-state__text">Ładowanie ofert...</p>
            </div>
          ) : remainingJobs.length > 0 ? (
            remainingJobs.map((job, index) => (
              <TinderCard key={job.id} ref={childRefs[index]} onSwipe={(dir) => onSwipe(dir, job)}
                preventSwipe={['up', 'down']} swipeRequirementType="position" className="swipe-card">
                <article className="job-card">
                  <div>
                    <h2 className="job-card__title">{job.title}</h2>
                    <p className="job-card__company">{job.company}</p>
                    <p className="job-card__salary">{formatSalary(job.salary_min, job.salary_max)}</p>
                    <ul className="job-card__tags">
                      {(job.technologies || []).map(tech => (
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
              <p className="empty-state__title">To już wszystkie oferty!</p>
              <p className="empty-state__text">Masz {savedJobs.length} zapisanych ofert. Zmień filtry żeby zobaczyć więcej.</p>
            </div>
          )}
        </section>
      </div>

      <button onClick={() => setIsModalOpen(true)} className="btn-outline">
        📋 Zapisane oferty ({savedJobs.length})
      </button>

      {isModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="saved-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
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
                {savedJobs.map(job => (
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
