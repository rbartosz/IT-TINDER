// glowny serwer Express - tu siedzi cale REST API
// odpalasz: node server.js (z folderu server/)

require('dotenv').config();              // wczytuje zmienne z pliku .env
const express = require('express');
const cors = require('cors');             // zeby frontend z innego portu mogl pukac
const bcrypt = require('bcrypt');         // hashowanie hasel
const jwt = require('jsonwebtoken');      // tokeny do logowania
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
// jak nie ma w .env to bierze defaultowy port
const PORT = process.env.PORT || 3000;
// sekret do podpisywania tokenow - na produkcji trzeba dac cos losowego
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

app.use(cors());                          // wlaczam CORS bo frontend lata na 5173
app.use(express.json());                  // parsuje body w formacie JSON

let db;                                   // globalna zmienna z baza, ustawiam ja w main()

// middleware - sprawdza czy user ma waznego JWT w naglowku Authorization
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // format naglowka: "Bearer <token>", wiec biorę drugi czlon po spacji
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Brak tokena.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Nieprawidłowy token.' });
    req.user = user;                      // doklejam usera do req zeby endpointy mialy dostep
    next();
  });
}

// middleware - po authenticateToken sprawdza czy to admin
function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Brak uprawnień admina.' });
  next();
}

// REJESTRACJA - tworze nowego usera, hasło hashuje bcryptem
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    // walidacja - bez tego baza zwraca brzydki blad
    if (!email || !password) return res.status(400).json({ error: 'Email i hasło są wymagane.' });
    const hashed = await bcrypt.hash(password, 10);   // 10 rund saltowania
    await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hashed, 'user']);
    res.status(201).json({ message: 'Zarejestrowano pomyślnie.' });
  } catch (err) {
    // jak email juz jest w bazie, sqlite rzuca constraint UNIQUE
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Email już istnieje.' });
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// LOGOWANIE - sprawdza haslo i zwraca JWT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email i hasło są wymagane.' });
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    // jak nie ma takiego usera albo zle haslo - dajemy ten sam komunikat zeby ktos nie zgadywal czy email istnieje
    if (!user) return res.status(401).json({ error: 'Nieprawidłowe dane logowania.' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Nieprawidłowe dane logowania.' });
    // token wazny 24h, w payloadzie role zeby frontend wiedzial czy pokazac admin panel
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// READ - lista wszystkich ofert z bazy (kazdy zalogowany)
app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const jobs = await db.all('SELECT * FROM jobs');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// CREATE - dodanie oferty (tylko admin)
app.post('/api/jobs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, company, description, technologies, location, salary } = req.body;
    if (!title) return res.status(400).json({ error: 'Tytuł jest wymagany.' });
    const result = await db.run(
      'INSERT INTO jobs (title, company, description, technologies, location, salary) VALUES (?, ?, ?, ?, ?, ?)',
      [title, company, description, technologies, location, salary]
    );
    // zwracam id nowo utworzonej oferty - przyda sie frontowi
    res.status(201).json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// UPDATE - edycja oferty po id (tylko admin)
app.put('/api/jobs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, company, description, technologies, location, salary } = req.body;
    const result = await db.run(
      'UPDATE jobs SET title = ?, company = ?, description = ?, technologies = ?, location = ?, salary = ? WHERE id = ?',
      [title, company, description, technologies, location, salary, req.params.id]
    );
    // jak result.changes == 0 to znaczy ze nie bylo takiego id
    if (result.changes === 0) return res.status(404).json({ error: 'Oferta nie znaleziona.' });
    res.json({ message: 'Zaktualizowano.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// DELETE - usuwanie oferty po id (tylko admin)
app.delete('/api/jobs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM jobs WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Oferta nie znaleziona.' });
    res.json({ message: 'Usunięto.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// admin: lista wszystkich userow (bez hasel oczywiscie!)
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    // SELECT id, email, role - WAZNE: nie wyciagam password, nawet hashu
    const users = await db.all('SELECT id, email, role FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// admin: usuwanie usera
app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Użytkownik nie znaleziony.' });
    res.json({ message: 'Usunięto.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// zapisanie swipa - jak user przesunie karte to leci tu request
app.post('/api/swipes', authenticateToken, async (req, res) => {
  try {
    const { job_id, status } = req.body;
    if (!job_id || !status) return res.status(400).json({ error: 'job_id i status są wymagane.' });
    // user_id biore z tokena, nie z body - inaczej kazdy moglby podszywac sie pod kogos
    await db.run('INSERT INTO swipes (user_id, job_id, status) VALUES (?, ?, ?)', [req.user.id, job_id, status]);
    res.status(201).json({ message: 'Zapisano.' });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera.' });
  }
});

// historia swipy z JOIN na 3 tabelki - admin widzi co kto polubil
// to jest wymaganie z laborki o JOINach
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

// integracja z zewnetrznym API Remotive - pobiera 10 najnowszych ofert programistycznych
app.get('/api/external/jobs', async (req, res) => {
  try {
    const remote = await fetch(
      'https://remotive.com/api/remote-jobs?category=software-dev&limit=10'
    );
    // jak Remotive padlo to lecimy z 502
    if (!remote.ok) throw new Error(`HTTP ${remote.status}`);
    const data = await remote.json();
    // ich format jest gruby, mapuje na nasz uproszczony
    const jobs = (data.jobs || []).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company_name,
      technologies: (j.tags || []).slice(0, 5),
      link: j.url,
    }));
    res.json(jobs);
  } catch (err) {
    // 502 Bad Gateway = problem z zewnetrznym serwisem (nie z naszym serverem)
    res.status(502).json({ error: 'Nie udało się pobrać danych z Remotive API.' });
  }
});

// stary endpoint odczytujacy oferty z pliku JSON (frontend tego uzywa do filtrowania po tagach)
// nie wymaga logowania zeby gosc moglo zobaczyc oferty zanim zaloguje sie i zacznie swipowac
app.get('/api/oferty', (req, res) => {
  const filePath = path.join(__dirname, 'oferty.json');
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Nie udało się odczytać ofert.' });
    try {
      let oferty = JSON.parse(data);
      const paramTech = req.query.tech;
      // jak jest query ?tech=aws,docker to filtrujemy
      if (paramTech && paramTech.trim() !== '') {
        const wybrane = paramTech.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        if (wybrane.length > 0) {
          // zostawiamy tylko oferty ktore maja chociaz jeden tag z listy
          oferty = oferty.filter(o => (o.technologies || []).some(tag => wybrane.includes(tag.toLowerCase())));
        }
      }
      res.json(oferty);
    } catch (e) {
      res.status(500).json({ error: 'Nieprawidłowy format JSON.' });
    }
  });
});

// inicjalizacja bazy i odpalenie servera
const http = require('http');

async function main() {
  // otwiera baze SQLite (sciezka z .env albo domyslnie database.db)
  db = await open({
    filename: process.env.DB_FILE || path.join(__dirname, 'database.db'),
    driver: sqlite3.Database
  });
  // wczytuje schema.sql i odpala go - tworzy tabelki jak jeszcze nie ma
  const schema = await fs.promises.readFile(path.join(__dirname, 'schema.sql'), 'utf-8');
  await db.exec(schema);

  // seed - tworzy konto admina przy pierwszym uruchomieniu
  // login: root@root.pl / haslo: rootroot
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

// jak cos sie wywali przy starcie to exit zeby ladnie umrzec
main().catch(err => {
  console.error('Błąd startu serwera:', err);
  process.exit(1);
});
