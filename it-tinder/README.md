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
│   └── .env.example    # Przykładowa konfiguracja
├── tests/              # Testy API
├── index.html          # Entry point Vite
├── vite.config.js      # Konfiguracja Vite
└── package.json        # Zależności frontendowe
```

## Technologie

- **Frontend:** React, Vite, axios, react-tinder-card
- **Backend:** Express, SQLite, bcrypt, JWT
- **Zewnętrzne API:** Remotive, Arbeitnow (pobieranie ofert pracy na żywo)

## Wymagania

- Node.js >= 18
- npm

## Instalacja i uruchomienie

```bash
# 1. Instalacja zależności frontendu
npm install

# 2. Instalacja zależności backendu
cd server
npm install

# 3. Konfiguracja zmiennych środowiskowych
copy .env.example .env
cd ..

# 4. Uruchomienie backendu (terminal 1)
npm run server

# 5. Uruchomienie frontendu (terminal 2)
npm run dev
```

Otwórz przeglądarkę na `http://localhost:5173`.

## Konto admina

Podczas pierwszego uruchomienia backend automatycznie tworzy konto administratora:

- **Email:** `root@root.pl`
- **Hasło:** `rootroot`

## Pobieranie ofert

Serwer automatycznie pobiera oferty pracy z zewnętrznych API (Remotive, Arbeitnow) przy starcie oraz odświeża je co 5 minut. Nie wymaga osobnej konfiguracji.

## API Endpoints

| Metoda | Ścieżka | Opis | Auth |
|--------|---------|------|------|
| POST | `/api/auth/register` | Rejestracja | ❌ |
| POST | `/api/auth/login` | Logowanie (zwraca JWT) | ❌ |
| GET | `/api/oferty` | Lista ofert (z zewnętrznych API + baza) | ❌ |
| GET | `/api/jobs` | Lista ofert z bazy | token |
| POST | `/api/jobs` | Dodaj ofertę | admin |
| PUT | `/api/jobs/:id` | Edytuj ofertę | admin |
| DELETE | `/api/jobs/:id` | Usuń ofertę | admin |
| GET | `/api/admin/users` | Lista użytkowników | admin |
| DELETE | `/api/admin/users/:id` | Usuń użytkownika | admin |
| POST | `/api/swipes` | Zapisz swipe | token |
| GET | `/api/swipes/history` | Historia swipów (JOIN) | admin |

## Testy

```bash
npm test
```

Backend musi działać na porcie 3000. Test runner uruchamia 9 testów API (rejestracja, logowanie, autoryzacja, filtrowanie, integracja z Remotive, walidacja).
