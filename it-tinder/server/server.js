require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

app.use(cors());
app.use(express.json());

let db;

// Middleware: weryfikacja tokena JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Brak tokena.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Nieprawidłowy token.' });
    req.user = user;
    next();
  });
}

// Middleware: sprawdzenie roli admina
function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Brak uprawnień admina.' });
  next();
}

// Rejestracja użytkownika
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email i hasło są wymagane.' });
    const hashed = await bcrypt.hash(password, 10);
    await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hashed, 'user']);
    res.status(201).json({ message: 'Zarejestrowano pomyślnie.' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Email już istnieje.' });
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Logowanie – zwraca token JWT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email i hasło są wymagane.' });
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Nieprawidłowe dane logowania.' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Nieprawidłowe dane logowania.' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Pobranie listy ofert pracy
app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const jobs = await db.all('SELECT * FROM jobs');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Dodanie nowej oferty (tylko admin)
app.post('/api/jobs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, company, description, technologies, location, salary } = req.body;
    if (!title) return res.status(400).json({ error: 'Tytuł jest wymagany.' });
    const result = await db.run(
      'INSERT INTO jobs (title, company, description, technologies, location, salary) VALUES (?, ?, ?, ?, ?, ?)',
      [title, company, description, technologies, location, salary]
    );
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Aktualizacja oferty (tylko admin)
app.put('/api/jobs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, company, description, technologies, location, salary } = req.body;
    const result = await db.run(
      'UPDATE jobs SET title = ?, company = ?, description = ?, technologies = ?, location = ?, salary = ? WHERE id = ?',
      [title, company, description, technologies, location, salary, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Oferta nie znaleziona.' });
    res.json({ message: 'Zaktualizowano.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Usunięcie oferty (tylko admin)
app.delete('/api/jobs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Oferta nie znaleziona.' });
    res.json({ message: 'Usunięto.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Admin: lista użytkowników
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await db.all('SELECT id, email, role FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Admin: usunięcie użytkownika
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Użytkownik nie znaleziony.' });
    res.json({ message: 'Usunięto.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Zapisanie swipe'a (polubienie/odrzucenie oferty)
app.post('/api/swipes', authenticateToken, async (req, res) => {
  try {
    const { job_id, status } = req.body;
    if (!job_id || !status) return res.status(400).json({ error: 'job_id i status są wymagane.' });
    await db.run('INSERT INTO swipes (user_id, job_id, status) VALUES (?, ?, ?)', [req.user.id, job_id, status]);
    res.status(201).json({ message: 'Zapisano.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Historia swipe'y z JOIN (admin)
app.get('/api/swipes/history', authenticateToken, isAdmin, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT swipes.id, swipes.status, swipes.user_id,
             users.email AS user_email,
             jobs.title AS job_title, jobs.company AS job_company
      FROM swipes
      JOIN users ON swipes.user_id = users.id
      JOIN jobs ON swipes.job_id = jobs.id
      ORDER BY swipes.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// Integracja z zewnętrznym API Remotive
app.get('/api/external/jobs', async (req, res) => {
  try {
    const remote = await fetch(
      'https://remotive.com/api/remote-jobs?category=software-dev&limit=10'
    );
    if (!remote.ok) throw new Error(`HTTP ${remote.status}`);
    const data = await remote.json();
    const jobs = (data.jobs || []).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company_name,
      technologies: (j.tags || []).slice(0, 5),
      link: j.url,
    }));
    res.json(jobs);
  } catch (err) {
    res.status(502).json({ error: 'Nie udało się pobrać danych z Remotive API.' });
  }
});

// Kompatybilny endpoint dla frontendu – odczyt ofert z pliku JSON (bez autoryzacji)
app.get('/api/oferty', (req, res) => {
  const filePath = path.join(__dirname, 'oferty.json');
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Nie udało się odczytać ofert.' });
    try {
      let oferty = JSON.parse(data);
      const paramTech = req.query.tech;
      if (paramTech && paramTech.trim() !== '') {
        const wybrane = paramTech.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (wybrane.length > 0) {
          oferty = oferty.filter(o => (o.technologies || []).some(tag => wybrane.includes(tag.toLowerCase())));
        }
      }
      res.json(oferty);
    } catch (e) {
      res.status(500).json({ error: 'Nieprawidłowy format JSON.' });
    }
  });
});

// Inicjalizacja bazy i start serwera
const http = require('http');

async function main() {
  db = await open({
    filename: process.env.DB_FILE || path.join(__dirname, 'database.db'),
    driver: sqlite3.Database
  });
  const schema = await fs.promises.readFile(path.join(__dirname, 'schema.sql'), 'utf-8');
  await db.exec(schema);

  // Seed: konto admina root/rootroot
  const existing = await db.get('SELECT id FROM users WHERE email = ?', ['root@root.pl']);
  if (!existing) {
    const hashed = await bcrypt.hash('rootroot', 10);
    await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', ['root@root.pl', hashed, 'admin']);
  }

  console.log('Baza danych gotowa.');

  const server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT} – http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Błąd startu serwera:', err);
  process.exit(1);
});
