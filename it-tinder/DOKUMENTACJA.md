# Dokumentacja techniczna – IT Tinder

**Przedmiot:** Programowanie Aplikacji Internetowych

---

## 1. Opis aplikacji

IT Tinder to aplikacja webowa do przeglądania ofert pracy w IT. Pomysł jest prosty – zamiast scrollować nieskończone listy ofert, użytkownik przegląda je pojedynczo w formie kart (jak w Tinderze). Swipe w prawo zapisuje ofertę, w lewo pomija.

Aplikacja pobiera oferty z dwóch zewnętrznych API (Remotive i Arbeitnow), zapisuje je do lokalnej bazy SQLite i serwuje użytkownikom. Zalogowany user może filtrować oferty po technologiach i zakresie wynagrodzenia. Admin ma osobny panel do zarządzania użytkownikami i podglądu statusu serwera.

Główne funkcje:
- rejestracja/logowanie (JWT + bcrypt)
- swipowanie ofert pracy z animacją kart
- filtrowanie po technologiach i widełkach
- zapisywanie polubionych ofert z linkiem do aplikowania
- panel admina (lista userów, usuwanie kont, status serwera)
- automatyczne pobieranie ofert z zewnętrznych API przy starcie

---

## 2. Architektura

```
┌──────────────────┐       HTTP/JSON (async)      ┌──────────────────┐
│   PRZEGLĄDARKA   │ ◄──────────────────────────► │     BACKEND      │
│  React + Vite    │    axios / fetch             │  Express (Node)  │
│  port 5173       │                              │  port 3000       │
└──────────────────┘                              └────────┬─────────┘
                                                           │
                                           ┌───────────────┼───────────────┐
                                           ▼                               ▼
                                   ┌───────────────┐              ┌────────────────┐
                                   │   SQLite DB   │              │ Zewnętrzne API │
                                   │ database.db   │              │ Remotive       │
                                   └───────────────┘              │ Arbeitnow      │
                                                                  └────────────────┘
```

| Warstwa | Technologie | Co robi |
|---------|-------------|---------|
| Frontend | React 18, Vite, axios, react-tinder-card | Interfejs, swipowanie, walidacja formularzy |
| Backend | Node.js, Express, JWT, bcrypt | REST API, autoryzacja, pobieranie ofert |
| Baza danych | SQLite | Przechowywanie userów, ofert i swipów |
| Zewnętrzne API | Remotive, Arbeitnow | Źródło ofert pracy (pobierane przy starcie serwera) |

---

## 3. Baza danych

Schemat w pliku `server/schema.sql`. Trzy tabele połączone kluczami obcymi:

### users

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INTEGER PK | — |
| email | TEXT UNIQUE | login użytkownika |
| password | TEXT | hash bcrypt |
| role | TEXT | `user` lub `admin` |

### jobs

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INTEGER PK | — |
| external_id | TEXT UNIQUE | id z API (żeby nie duplikować) |
| title | TEXT | nazwa stanowiska |
| company | TEXT | firma |
| technologies | TEXT | tagi jako JSON array |
| salary_min | INTEGER | dolna widełka (PLN/mies.) |
| salary_max | INTEGER | górna widełka |
| link | TEXT | URL do oferty |
| description | TEXT | opis (opcjonalny) |
| location | TEXT | lokalizacja |

### swipes

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | INTEGER PK | — |
| user_id | INTEGER FK → users | kto swipował |
| job_id | INTEGER FK → jobs | którą ofertę |
| status | TEXT | `liked` / `disliked` |

Relacja: `users (1) ──< swipes >── (1) jobs`

Indeksy: `email` (logowanie), `company` (filtrowanie), `external_id` (upsert), `user_id` (historia swipów).

Endpoint `/api/swipes/history` robi JOIN po obu kluczach obcych żeby admin widział kto co polubił.

---

## 4. Endpointy API

Odpowiedzi zawsze w JSON. Token w nagłówku `Authorization: Bearer <token>`.

| Metoda | Ścieżka | Auth | Opis |
|--------|---------|------|------|
| POST | `/api/auth/register` | — | rejestracja |
| POST | `/api/auth/login` | — | logowanie, zwraca JWT |
| GET | `/api/oferty` | — | pobiera oferty z API, zapisuje do bazy, zwraca wszystkie |
| GET | `/api/jobs` | token | lista ofert z bazy |
| POST | `/api/jobs` | admin | dodanie oferty |
| PUT | `/api/jobs/:id` | admin | edycja oferty |
| DELETE | `/api/jobs/:id` | admin | usunięcie oferty |
| POST | `/api/swipes` | token | zapis swipa |
| GET | `/api/swipes/history` | admin | historia swipów (JOIN) |
| GET | `/api/admin/users` | admin | lista userów |
| DELETE | `/api/admin/users/:id` | admin | usunięcie usera |
| GET | `/api/admin/status` | admin | status serwera (uptime, db, pamięć) |

Kody: 200, 201, 400 (walidacja), 401 (brak tokena), 403 (brak uprawnień), 404, 500, 502 (błąd API).

### Przykład – rejestracja

```
POST /api/auth/register
{ "email": "jan@example.com", "password": "mojehaslo123" }

→ 201: { "message": "Zarejestrowano pomyślnie." }
→ 400: { "error": "Email już istnieje." }
```

### Przykład – logowanie

```
POST /api/auth/login
{ "email": "jan@example.com", "password": "mojehaslo123" }

→ 200: { "token": "eyJhbGciOi..." }
```

### Przykład – pobranie ofert

```
GET /api/jobs
Authorization: Bearer eyJhbGciOi...

→ 200: [{ "id": 1, "title": "Backend Dev", "company": "Acme", "salary_min": 15000, ... }]
```

---

## 5. Uruchomienie

Potrzebne: Node.js >= 18, npm.

```bash
# instalacja
npm install
cd server && npm install && cd ..

# konfiguracja
cp server/.env.example server/.env

# terminal 1 – backend
cd server && node server.js

# terminal 2 – frontend
npx vite
```

Aplikacja dostępna pod `http://localhost:5173`.

Konto admina tworzy się automatycznie:
- email: `root@root.pl`
- hasło: `rootroot`

---

## 6. Testy

Uruchomienie (backend musi działać):

```
npm test
```

Wynik:

```
Testy API IT Tinder

  ✓ POST /api/auth/register – rejestracja
  ✓ POST /api/auth/login – logowanie
  ✓ GET /api/oferty – lista ofert
  ✓ GET /api/oferty?tech=aws – filtrowanie
  ✓ GET /api/jobs – brak autoryzacji = 401
  ✓ GET /api/jobs – z tokenem
  ✓ GET /api/swipes/history – bez admina = 403
  ✓ POST /api/auth/register – brak hasła = 400
  ✓ GET /api/swipes/history – bez admina = 403

Wyniki: 9 zaliczone, 0 błędów
```

Testy sprawdzają: rejestrację, logowanie, pobieranie ofert, filtrowanie, ochronę endpointów tokenem, autoryzację rolą admina i walidację danych wejściowych.
