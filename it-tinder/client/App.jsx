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

  const onSwipe = (direction, job) => {
    if (direction === 'right') {
      setSavedJobs((prev) => [...prev, job]);
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

  // Auth screens
  if (!token) {
    return authView === 'login'
      ? <Login onLogin={handleLogin} onSwitch={() => setAuthView('register')} />
      : <Register onSwitch={() => setAuthView('login')} />;
  }

  if (showAdmin && userRole === 'admin') {
    return <AdminPanel token={token} onBack={() => setShowAdmin(false)} />;
  }

  // Profile config screen
  if (!isProfileSet) {
    return (
      <div className="page-center">
        <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', padding: '12px 16px' } }} />
        <div className="card">
          <h1 className="title">🔥 IT Tinder</h1>
          <p className="subtitle subtitle--wide">Konfiguracja profilu</p>

          <div className="checkbox-list">
            <p className="section-label">Wybierz technologie, które Cię interesują:</p>
            {DOSTEPNE_TECHNOLOGIE.map((tech) => (
              <label key={tech} className="checkbox-item">
                <input type="checkbox" checked={selectedTechs.includes(tech)} onChange={() => handleCheckboxChange(tech)} />
                <span>{tech}</span>
              </label>
            ))}
          </div>

          {noResults && <p className="alert-warning">Brak ofert dla wybranych technologii. Spróbuj innych.</p>}

          <button onClick={handleStartSearch} disabled={selectedTechs.length === 0 || isLoading} className="btn-primary">
            {isLoading ? (
              <span className="spinner">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path opacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ładowanie...
              </span>
            ) : 'Rozpocznij szukanie'}
          </button>

          {selectedTechs.length === 0 && <p className="hint">Zaznacz przynajmniej jedną technologię</p>}
        </div>
      </div>
    );
  }

  // Main swipe view
  return (
    <div className="page-top">
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', padding: '12px 16px' } }} />

      <h1 className="title title--lg">🔥 IT Tinder</h1>
      <p className="subtitle">Przesuń w prawo, aby zapisać · Przesuń w lewo, aby pominąć</p>

      <div className="header-bar">
        {userRole === 'admin' && (
          <button onClick={() => setShowAdmin(true)} className="btn-admin">🛡️ Admin</button>
        )}
        <button onClick={handleLogout} className="btn-secondary">Wyloguj</button>
      </div>

      <div className="card-stack">
        {remainingJobs.length > 0 ? (
          remainingJobs.map((job, index) => (
            <TinderCard key={job.id} ref={childRefs[index]} onSwipe={(dir) => onSwipe(dir, job)}
              preventSwipe={['up', 'down']} swipeRequirementType="position" className="swipe-card">
              <div className="job-card">
                <div>
                  <h2 className="job-card__title">{job.title}</h2>
                  <p className="job-card__company">{job.company}</p>
                  <p className="job-card__salary">{formatSalary(job.salary_min, job.salary_max)}</p>
                  <div className="job-card__tags">
                    {job.technologies.map((tech) => (
                      <span key={tech} className="job-card__tag">{tech}</span>
                    ))}
                  </div>
                </div>
                <div className="job-card__footer">
                  <span>Swipe ➡️ aby zapisać</span>
                  <span>⬅️ aby pominąć</span>
                </div>
              </div>
            </TinderCard>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon">🎉</span>
            <p className="empty-state__title">To już wszystkie oferty na dziś!</p>
            <p className="empty-state__text">Masz {savedJobs.length} zapisanych ofert w przeglądarce.</p>
          </div>
        )}
      </div>

      <button onClick={() => setIsModalOpen(true)} className="btn-outline">
        📋 Zapisane oferty ({savedJobs.length})
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">Twoje ulubione oferty</h2>
              <div className="modal__actions">
                {savedJobs.length > 0 && (
                  <button onClick={handleDeleteAll} className="btn-delete-all">Usuń wszystkie</button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="btn-close">✕</button>
              </div>
            </div>

            {savedJobs.length > 0 ? (
              <div className="saved-list">
                {savedJobs.map((job) => (
                  <div key={job.id} className="saved-item">
                    <div className="saved-item__info">
                      <h3 className="saved-item__title">{job.title}</h3>
                      <p className="saved-item__company">{job.company}</p>
                      <p className="saved-item__salary">{formatSalary(job.salary_min, job.salary_max)}</p>
                    </div>
                    <div className="saved-item__actions">
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="btn-apply">Aplikuj</a>
                      <button onClick={() => handleDeleteOne(job.id)} className="btn-remove" title="Usuń ofertę">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state__icon">💔</span>
                <p className="empty-state__text">Nie masz jeszcze żadnych zapisanych ofert. Przesuwaj karty w prawo!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
