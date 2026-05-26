import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPanel({ token, onBack }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/admin/users', { headers });
      setUsers(res.data);
    } catch (err) {
      setError('Nie udało się pobrać użytkowników.');
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id, email) => {
    if (!confirm(`Usunąć użytkownika ${email}?`)) return;
    try {
      await axios.delete(`http://localhost:3000/api/admin/users/${id}`, { headers });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError('Nie udało się usunąć użytkownika.');
    }
  };

  return (
    <main className="page-top">
      <div className="admin-container">
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
                  <span className={`user-item__role ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>
                    {u.role}
                  </span>
                </div>
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
