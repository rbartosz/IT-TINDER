-- struktura bazy SQLite, te tabelki tworza sie automatycznie przy starcie servera

-- userzy z rolami (user/admin)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,           -- login = email, musi byc unikalny
  password TEXT NOT NULL,                -- hash z bcrypta, nie plaintext!
  role TEXT DEFAULT 'user'               -- domyslnie kazdy nowy to user
);
-- indeks zeby logowanie po mailu szybko leciało
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- tabelka z ofertami pracy (admin moze dodawac/edytowac/usuwac)
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,                   -- nazwa stanowiska
  company TEXT,
  description TEXT,
  technologies TEXT,                     -- lista techow rozdzielona przecinkami
  location TEXT,
  salary TEXT
);
-- indeks na company bo czesto filtrujemy po firmie
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);

-- swipy = polubienia/odrzucenia ofert przez userow (jak w Tinderze)
CREATE TABLE IF NOT EXISTS swipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,              -- ktory user
  job_id INTEGER NOT NULL,               -- ktora oferta
  status TEXT NOT NULL,                  -- 'liked' albo 'disliked'
  -- foreign keys czyli laczenie z innymi tabelkami
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
-- indeks zeby szybko znalezc swipy konkretnego usera
CREATE INDEX IF NOT EXISTS idx_swipes_user_id ON swipes(user_id);
