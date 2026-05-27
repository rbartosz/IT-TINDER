-- struktura bazy SQLite, te tabelki tworza sie automatycznie przy starcie servera

-- userzy z rolami (user/admin)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user'
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- tabelka z ofertami pracy (z API + admin moze dodawac/edytowac/usuwac)
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,               -- id z zewnetrznego API (do deduplikacji)
  title TEXT NOT NULL,
  company TEXT,
  description TEXT,
  technologies TEXT,                     -- lista techow rozdzielona przecinkami
  location TEXT,
  salary TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  link TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id);

-- swipy = polubienia/odrzucenia ofert przez userow
CREATE TABLE IF NOT EXISTS swipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_swipes_user_id ON swipes(user_id);
