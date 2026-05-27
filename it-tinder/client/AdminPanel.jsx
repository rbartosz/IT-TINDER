// panel admina – dashboard ze statusem i lista userow
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPanel({ token, onBack }) {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/admin/users', { headers });
      setUsers(res.data);
    } catch {
      setError('Nie udalo sie pobrac uzytkownikow.');
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/admin/status', { headers });
      setStatus(res.data);
    } catch {
      setStatus({ status: 'error' });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStatus();
  }, []);

  const handleDelete = async (id, email) => {
    if (!confirm(`Usunac uzytkownika ${email}?`)) return;
    try {
      await axios.delete(`http://localhost:3000/api/admin/users/${id}`, { headers });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setError('Nie udalo sie usunac uzytkownika.');
    }
  };

  const statusDot = (ok) => (
    <span
      className={`status-dot ${ok === 'ok' ? 'status-ok' : 'status-err'}`}
      aria-hidden="true"
    />
  );

  const formatUptime = (s) => {
    if (!s && s !== 0) return '-';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const statusItems = status ? [
    { label: 'Serwer',        value: <>{statusDot(status.status === 'online' ? 'ok' : 'err')} {status.status === 'online' ? 'Online' : 'Offline'}</> },
    { label: 'Uptime',        value: formatUptime(status.uptime) },
    { label: 'Baza danych',   value: <>{statusDot(status.db)} {status.db === 'ok' ? 'OK' : 'Blad'}</> },
    { label: 'Remotive API',  value: <>{statusDot(status.remotive_api)} {status.remotive_api === 'ok' ? 'Dostepne' : 'Offline'}</> },
    { label: 'Cache ofert',   value: `${status.cache?.offers ?? '-'} ofert${status.cache?.age_sec != null ? ` (${status.cache.age_sec}s temu)` : ''}` },
    { label: 'Pamiec',        value: status.memory || '-' },
    { label: 'Node.js',       value: status.node || '-' },
  ] : [];

  return (
    <main className="page-top">
      <div className="admin-container">
        <header className="admin-header">
          <h1 className="admin-title">Administracja</h1>
          <nav>
            <button onClick={onBack} className="btn-secondary">Wroc do aplikacji</button>
          </nav>
        </header>

        {error && <p className="alert-error" role="alert">{error}</p>}

        <section className="admin-card" aria-labelledby="status-label">
          <h2 id="status-label" className="admin-card__label">Status serwera</h2>
          {status ? (
            <div className="status-grid">
              {statusItems.map((item) => (
                <div key={item.label} className="status-item">
                  <span className="status-item__label">{item.label}</span>
                  <span className="status-item__value">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>Sprawdzanie...</p>
          )}
        </section>

        <section className="admin-card" aria-labelledby="users-label">
          <h2 id="users-label" className="admin-card__label">
            Uzytkownicy ({users.length})
          </h2>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id} className="user-item">
                <div>
                  <span className="user-item__email">{u.email}</span>
                  <span className={`user-item__role ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                    {u.role}
                  </span>
                </div>
                {u.role !== 'admin' && (
                  <button onClick={() => handleDelete(u.id, u.email)} className="btn-delete">
                    Usun
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
