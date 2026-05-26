# IT Tinder

Aplikacja do przeglądania ofert pracy IT w stylu Tindera. Przesuwaj karty w prawo by zapisać ofertę, w lewo by pominąć. Zalogowani użytkownicy mogą filtrować oferty po technologiach, a admin zarządza użytkownikami.

## Struktura projektu

```
it-tinder/
├── client/             # Frontend React + Vite
│   ├── App.jsx         # Główny komponent aplikacji
│   ├── Login.jsx       # Logowanie
│   ├── Register.jsx    # Rejestracja
│   ├── AdminPanel.jsx  # Panel administratora
│   ├── main.jsx        # Punkt wejścia React
│   ├── index.css       # Import styli
│   └── styles.css      # Główny arkusz styli
├── server/             # Backend Express + SQLite
│   ├── server.js       # Serwer REST API (port 3000)
│   ├── schema.sql      # Schemat bazy danych
│   └── oferty.json     # Oferty pracy (dane)
├── scraper/            # Pobieranie ofert z Remotive API
│   └── job_scraper.js  # Node.js scraper
├── tests/              # Testy
├── index.html          # Entry point Vite
├── vite.config.js      # Konfiguracja Vite
└── package.json        # Zależności frontendowe
```

## Technologie

- **Frontend:** React, Vite, axios, react-tinder-card
- **Backend:** Express, SQLite, bcrypt, JWT
- **Zewnętrzne API:** Remotive (pobieranie ofert pracy)

## Wymagania

- Node.js >= 18
- npm

## Instalacja

```bash
# Instalacja zależności frontendu
npm install

# Instalacja zależności backendu
cd server && npm install && cd ..

# Konfiguracja zmiennych środowiskowych
cp server/.env.example server/.env
```

## Uruchomienie

Potrzebujesz dwóch terminali:

**Terminal 1 – Backend (port 3000):**
```bash
npm run server
```

**Terminal 2 – Frontend (port 5173):**
```bash
npm run dev
```

Otwórz przeglądarkę na `http://localhost:5173`.

## Konto admina

Podczas pierwszego uruchomienia backend automatycznie tworzy konto administratora:

- **Email:** `root@root.pl`
- **Hasło:** `rootroot`

## API Endpoints

| Metoda | Ścieżka | Opis | Auth |
|--------|---------|------|------|
| POST | `/api/auth/register` | Rejestracja | ❌ |
| POST | `/api/auth/login` | Logowanie (zwraca JWT) | ❌ |
| GET | `/api/oferty` | Lista ofert (filtrowanie ?tech=) | ❌ |
| GET | `/api/jobs` | Lista ofert z bazy | token |
| POST | `/api/jobs` | Dodaj ofertę | admin |
| PUT | `/api/jobs/:id` | Edytuj ofertę | admin |
| DELETE | `/api/jobs/:id` | Usuń ofertę | admin |
| GET | `/api/admin/users` | Lista użytkowników | admin |
| DELETE | `/api/admin/users/:id` | Usuń użytkownika | admin |
| POST | `/api/swipes` | Zapisz swipe | token |
| GET | `/api/external/jobs` | Oferty z Remotive API | ❌ |

## Scraper

Pobiera oferty z Remotive API i zapisuje do `server/oferty.json`:

```bash
node scraper/job_scraper.js
```

## Testy

```bash
npm test
```

Backend musi działać na porcie 3000. Test runner uruchamia 9 testów API
(rejestracja, logowanie, autoryzacja, filtrowanie, integracja z Remotive, walidacja).
