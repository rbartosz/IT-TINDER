// panel admina - widoczny tylko dla usera z role='admin' (sprawdzane w App.jsx i na backendzie)
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPanel({ token, onBack }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  // naglowki z tokenem - dorzucam je do kazdego requestu
  const headers = { Authorization: `Bearer ${token}` };

  // pobiera wszystkich userow - backend filtruje wiec zwykly user dostalby 403
  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/admin/users', { headers });
      setUsers(res.data);
    } catch (err) {
      setError('Nie udało się pobrać użytkowników.');
    }
  };

  // useEffect z [] = odpala raz po zamontowaniu komponentu (czyli wjazd na panel)
  useEffect(() => { fetchUsers(); }, []);

  // usuwanie usera - prosty confirm zamiast modala, dla studenckiego projektu wystarczy
  const handleDelete = async (id, email) => {
    if (!confirm(`Usunąć użytkownika ${email}?`)) return;
    try {
      await axios.delete(`http://localhost:3000/api/admin/users/${id}`, { headers });
      // optymistyczne usuniecie z UI - nie czekam na ponowny fetch
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError('Nie udało się usunąć użytkownika.');
    }
  };

  return (
    <main className="page-top">
      <div className="admin-container">
        {/* header z tytulem i nawigacja - semantyczny HTML5 */}
        <header className="admin-header">
          <h1 className="admin-title">🛡️ Panel Admina</h1>
          <nav>
            <button onClick={onBack} className="btn-secondary">← Wróć do aplikacji</button>
          </nav>
        </header>

        {error && <p className="alert-error" role="alert">{error}</p>}

        <section className="admin-card" aria-labelledby="users-label">
          <h2 id="users-label" className="admin-card__label">Użytkownicy ({users.length})</h2>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id} className="user-item">
                <div>
                  <span className="user-item__email">{u.email}</span>
                  {/* badzik z rola - inny kolor dla admina i usera */}
                  <span className={`user-item__role ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                    {u.role}
                  </span>
                </div>
                {/* admina nie da sie usunac z UI zeby nie zostac bez admina */}
                {u.role !== 'admin' && (
                  <button onClick={() => handleDelete(u.id, u.email)} className="btn-delete">
                    Usuń
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
