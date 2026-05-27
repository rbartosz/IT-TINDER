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
    res.json(jobs.map(j => ({ ...j, technologies: JSON.parse(j.technologies || '[]') })));
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


// cache ofert z Remotive (deklaracja wczesniej bo uzywa jej /api/admin/status)
const IT_CATEGORIES = ['software-development', 'devops', 'artificial-intelligence', 'data', 'engineering', 'product'];
let offerCache = { data: null, ts: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minut

// admin: status serwera – pokazuje czy wszystko dziala
app.get('/api/admin/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const dbTest = await db.get('SELECT 1 AS ok');
    const remotiveOK = await fetch('https://remotive.com/api/remote-jobs?limit=1')
      .then(r => r.ok).catch(() => false);
    const cacheAge = offerCache.ts ? Math.round((Date.now() - offerCache.ts) / 1000) : null;
    const offerCount = offerCache.data ? offerCache.data.length : 0;
    res.json({
      status: 'online',
      uptime: Math.round(process.uptime()),
      db: dbTest ? 'ok' : 'error',
      cache: { offers: offerCount, age_sec: cacheAge },
      remotive_api: remotiveOK ? 'ok' : 'offline',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      node: process.version,
    });
  } catch (e) {
    res.status(500).json({ error: 'Blad sprawdzania statusu.' });
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

// LIVE endpoint – pobiera oferty z Remotive na zywo, filtruje po tagach z prawdziwymi widełkami
// salary jest w USD rocznie, przeliczamy na PLN miesięcznie (USD roczne * 3.8 / 12) – pobiera oferty na zywo z Remotive (cache 5 min), filtruje po tagach
// nie wymaga logowania zeby gosc mogl zobaczyc oferty zanim zaloguje sie i zacznie swipowac

function parseSalary(salaryStr) {
  if (!salaryStr) return { min: 5000, max: 10000 };
  const clean = salaryStr.replace(/^(OTE|up to|from)\s+/i, '').trim();
  const nums = clean.match(/\$?([\d,.]+)\s*k?\s*[-–]\s*\$?([\d,.]+)\s*k?/);
  if (!nums) return { min: 5000, max: 10000 };
  let min = parseFloat(nums[1].replace(',', '.'));
  let max = parseFloat(nums[2].replace(',', '.'));
  if (/k/i.test(clean)) { min *= 1000; max *= 1000; }
  if (clean.includes('/hour')) { min *= 160; max *= 160; }
  const isHourly = salaryStr.includes("/hour"); return { min: Math.round(min * 3.8 / (isHourly ? 1 : 12)), max: Math.round(max * 3.8 / (isHourly ? 1 : 12)) };
}

async function fetchFromRemotive() {
  // Remotive
  const remotiveJobs = await Promise.all(
    IT_CATEGORIES.map(cat =>
      fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=50`)
        .then(r => r.json())
        .then(d => d.jobs || [])
        .catch(() => [])
    )
  ).then(results => {
    const seen = new Set();
    return results.flat().filter(j => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    }).map(j => {
      const salary = parseSalary(j.salary);
      return {
        id: 'r_' + j.id,
        title: j.title,
        company: j.company_name,
        salary_min: salary.min,
        salary_max: salary.max,
        technologies: (j.tags || []).slice(0, 5),
        link: j.url,
      };
    });
  });

  // Arbeitnow (darmowe, bez klucza, 100 ofert)
  const arbeitnowJobs = await fetch('https://www.arbeitnow.com/api/job-board-api')
    .then(r => r.json())
    .then(d => (d.data || []).map(j => ({
      id: 'a_' + j.slug,
      title: j.title,
      company: j.company_name,
      salary_min: null,
      salary_max: null,
      technologies: (j.tags || []).slice(0, 5),
      link: j.url,
    })))
    .catch(() => []);

  return [...remotiveJobs, ...arbeitnowJobs];
}

app.get('/api/oferty', async (req, res) => {
  try {
    // cache 5-minutowy - pobiera z API i zapisuje do bazy
    if (!offerCache.data || Date.now() - offerCache.ts > CACHE_TTL) {
      const offers = await fetchFromRemotive();
      // upsert do bazy
      for (const o of offers) {
        await db.run(
          `INSERT INTO jobs (external_id, title, company, technologies, salary_min, salary_max, link)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(external_id) DO UPDATE SET title=excluded.title, company=excluded.company,
           technologies=excluded.technologies, salary_min=excluded.salary_min, salary_max=excluded.salary_max, link=excluded.link`,
          [o.id, o.title, o.company, JSON.stringify(o.technologies), o.salary_min, o.salary_max, o.link]
        );
      }
      offerCache = { data: offers, ts: Date.now() };
    }
    // zwraca z bazy
    const jobs = await db.all('SELECT * FROM jobs');
    res.json(jobs.map(j => ({ ...j, technologies: JSON.parse(j.technologies || '[]') })));
  } catch (e) {
    res.status(502).json({ error: 'Nie udało się pobrać ofert.' });
  }
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

  // migracja - dodaj kolumny jesli nie istnieja (dla istniejacych baz)
  // musi byc PRZED schema.sql bo schema tworzy indeksy na nowych kolumnach
  const cols = await db.all("PRAGMA table_info(jobs)").catch(() => []);
  if (cols.length > 0) {
    const colNames = cols.map(c => c.name);
    if (!colNames.includes('external_id')) await db.exec('ALTER TABLE jobs ADD COLUMN external_id TEXT');
    if (!colNames.includes('salary_min')) await db.exec('ALTER TABLE jobs ADD COLUMN salary_min INTEGER');
    if (!colNames.includes('salary_max')) await db.exec('ALTER TABLE jobs ADD COLUMN salary_max INTEGER');
    if (!colNames.includes('link')) await db.exec('ALTER TABLE jobs ADD COLUMN link TEXT');
    // upewnij sie ze indeks external_id jest UNIQUE
    await db.exec('DROP INDEX IF EXISTS idx_jobs_external_id');
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id)');
  }

  await db.exec(schema);

  // seed - tworzy konto admina przy pierwszym uruchomieniu
  // login: root@root.pl / haslo: rootroot
  const existing = await db.get('SELECT id FROM users WHERE email = ?', ['root@root.pl']);
  if (!existing) {
    const hashed = await bcrypt.hash('rootroot', 10);
    await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', ['root@root.pl', hashed, 'admin']);
  }

  console.log('Baza danych gotowa.');

  // przy starcie pobierz oferty z API i zapisz do bazy
  try {
    const offers = await fetchFromRemotive();
    for (const o of offers) {
      await db.run(
        `INSERT INTO jobs (external_id, title, company, technologies, salary_min, salary_max, link)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(external_id) DO UPDATE SET title=excluded.title, company=excluded.company,
         technologies=excluded.technologies, salary_min=excluded.salary_min, salary_max=excluded.salary_max, link=excluded.link`,
        [o.id, o.title, o.company, JSON.stringify(o.technologies), o.salary_min, o.salary_max, o.link]
      );
    }
    offerCache = { data: offers, ts: Date.now() };
    console.log(`Zaladowano ${offers.length} ofert do bazy.`);
  } catch (e) {
    console.log('Nie udalo sie pobrac ofert z API:', e.message);
  }

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
