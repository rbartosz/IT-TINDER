# Dokumentacja techniczna – IT Tinder

**Przedmiot:** Programowanie Aplikacji Internetowych
**Repozytorium:** `PROJEKT_LABY`

---

## 1. Opis aplikacji

**IT Tinder** to aplikacja webowa pozwalająca przeglądać oferty pracy IT w formacie inspirowanym
aplikacją Tinder – użytkownik widzi pojedynczą ofertę, którą może *przesunąć w prawo* (zapisać do
ulubionych) lub *w lewo* (pominąć). Aplikacja jest skierowana do osób szukających pracy
w branży IT, które chcą szybko przefiltrować rynek bez przewijania długich list.

**Główne funkcjonalności:**

- Rejestracja i logowanie użytkowników (hasła hashowane bcryptem, sesja oparta o JWT).
- Konfiguracja profilu – wybór technologii, którymi użytkownik jest zainteresowany.
- Filtrowanie ofert z lokalnej bazy po tagach technologicznych.
- Pobieranie aktualnych ofert z zewnętrznego API **Remotive**.
- Mechanika swipe (zapisanie / pominięcie) z trwałym zapisem polubień w bazie.
- Lista zapisanych ofert z bezpośrednim linkiem do aplikowania.
- Panel administratora – zarządzanie kontami użytkowników, dodawanie / edycja / usuwanie ofert.
- Dwie role: `user` i `admin` z rozdzielonymi uprawnieniami.

---

## 2. Architektura systemu

```
┌──────────────────┐         HTTPS/JSON          ┌──────────────────┐
│   PRZEGLĄDARKA   │ ◄─────────────────────────► │     BACKEND      │
│  React + Vite    │   fetch / axios (async)     │  Express (Node)  │
│  (client/)       │                             │  (server/)       │
└──────────────────┘                             └────────┬─────────┘
                                                          │
                                          ┌───────────────┼─────────────────┐
                                          ▼                                 ▼
                                  ┌───────────────┐                ┌─────────────────┐
                                  │   SQLite DB   │                │  Remotive API   │
                                  │ database.db   │                │ (zewnętrzne)    │
                                  └───────────────┘                └─────────────────┘
```

**Warstwy:**

| Warstwa             | Technologie                                      | Odpowiedzialność |
|---------------------|--------------------------------------------------|------------------|
| Frontend            | React 18, Vite, axios, react-tinder-card, react-hot-toast | UI, walidacja po stronie klienta, swipe, komunikacja z API |
| Backend             | Node.js, Express 5, JWT, bcrypt, dotenv          | REST API, autoryzacja, walidacja serwerowa, integracja z DB i Remotive |
| Baza danych         | SQLite (lokalny plik `database.db`)              | Trwałe przechowywanie użytkowników, ofert i polubień |
| Zewnętrzne API      | Remotive Jobs API                                | Aktualne oferty pracy zdalnej |

---

## 3. Struktura bazy danych

Plik `server/schema.sql` zawiera pełen skrypt tworzący strukturę. Trzy tabele z relacjami:

### Tabela `users`

| Kolumna   | Typ                 | Opis                                |
|-----------|---------------------|-------------------------------------|
| id        | INTEGER PK AUTO     | Identyfikator użytkownika           |
| email     | TEXT UNIQUE NOT NULL | Email (loginem)                    |
| password  | TEXT NOT NULL       | Hasło zhashowane bcryptem           |
| role      | TEXT DEFAULT 'user' | Rola: `user` albo `admin`           |

Indeks: `idx_users_email` na kolumnie `email`.

### Tabela `jobs`

| Kolumna       | Typ                 | Opis                            |
|---------------|---------------------|---------------------------------|
| id            | INTEGER PK AUTO     | Identyfikator oferty            |
| title         | TEXT NOT NULL       | Tytuł stanowiska                |
| company       | TEXT                | Nazwa firmy                     |
| description   | TEXT                | Opis oferty                     |
| technologies  | TEXT                | Lista technologii (CSV)         |
| location      | TEXT                | Lokalizacja                     |
| salary        | TEXT                | Widełki płacowe                 |

Indeks: `idx_jobs_company` na kolumnie `company` (często używana do filtrowania).

### Tabela `swipes`

| Kolumna  | Typ                | Opis                                    |
|----------|--------------------|-----------------------------------------|
| id       | INTEGER PK AUTO    | Identyfikator polubienia                |
| user_id  | INTEGER NOT NULL FK → users(id) | Użytkownik, który zaswipował |
| job_id   | INTEGER NOT NULL FK → jobs(id)  | Oferta, której dotyczy       |
| status   | TEXT NOT NULL      | `liked` / `disliked`                    |

Indeks: `idx_swipes_user_id` na kolumnie `user_id`.

**Relacje (klucze obce):**

```
users (1) ──< swipes >── (1) jobs
```

Endpoint `GET /api/swipes/history` używa JOIN-a po obu kluczach obcych, by pokazać adminowi
historię polubień razem z emailem użytkownika i tytułem oferty.

---

## 4. Opis API (REST)

Wszystkie odpowiedzi w formacie JSON. Autoryzacja przez nagłówek `Authorization: Bearer <token>`.

| Metoda  | Ścieżka                       | Auth   | Opis                                         |
|---------|-------------------------------|--------|----------------------------------------------|
| POST    | `/api/auth/register`          | —      | Rejestracja nowego użytkownika               |
| POST    | `/api/auth/login`             | —      | Logowanie, zwraca JWT                        |
| GET     | `/api/oferty`                 | —      | Lista ofert z pliku JSON, filtr `?tech=`     |
| GET     | `/api/jobs`                   | user   | Lista ofert z bazy SQLite                    |
| POST    | `/api/jobs`                   | admin  | Dodanie nowej oferty                         |
| PUT     | `/api/jobs/:id`               | admin  | Aktualizacja oferty                          |
| DELETE  | `/api/jobs/:id`               | admin  | Usunięcie oferty                             |
| POST    | `/api/swipes`                 | user   | Zapis swipe'u (`liked` / `disliked`)         |
| GET     | `/api/swipes/history`         | admin  | Historia swipe'ów z JOIN po users + jobs     |
| GET     | `/api/admin/users`            | admin  | Lista wszystkich użytkowników                |
| DELETE  | `/api/admin/users/:id`        | admin  | Usunięcie użytkownika                        |
| GET     | `/api/external/jobs`          | —      | Pobranie ofert z zewnętrznego Remotive API   |

**Kody statusów:** `200 OK`, `201 Created`, `400 Bad Request` (walidacja), `401 Unauthorized`
(brak / zły token), `403 Forbidden` (brak uprawnień admina), `404 Not Found`, `500 Internal Server Error`,
`502 Bad Gateway` (problem z zewnętrznym API).

### Przykład: rejestracja

**Request:**

```http
POST /api/auth/register
Content-Type: application/json

{ "email": "jan@example.com", "password": "tajneHaslo123" }
```

**Response 201:**

```json
{ "message": "Zarejestrowano pomyślnie." }
```

**Response 400 (email zajęty):**

```json
{ "error": "Email już istnieje." }
```

### Przykład: logowanie

**Request:**

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "jan@example.com", "password": "tajneHaslo123" }
```

**Response 200:**

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

### Przykład: lista ofert (chroniona)

**Request:**

```http
GET /api/jobs
Authorization: Bearer eyJhbGciOi...
```

**Response 200:**

```json
[
  { "id": 1, "title": "Backend Dev", "company": "Acme", "technologies": "node,sql", ... }
]
```

---

## 5. Instrukcja uruchomienia

**Wymagania:** Node.js ≥ 18, npm.

```bash
# 1. Klon repozytorium
git clone https://github.com/rbartosz/PROJEKT_LABY.git
cd PROJEKT_LABY/it-tinder

# 2. Instalacja zależności
npm install
cd server && npm install && cd ..

# 3. Konfiguracja środowiska
cp server/.env.example server/.env
# (wartości domyślne wystarczą do dev; w produkcji zmień JWT_SECRET)

# 4a. Terminal 1 – backend (port 3000)
npm run server

# 4b. Terminal 2 – frontend (port 5173)
npm run dev

# 5. Otwórz przeglądarkę
# http://localhost:5173
```

**Konto admina (seedowane automatycznie przy pierwszym starcie):**

- Email: `root@root.pl`
- Hasło: `rootroot`

---

## 6. Raport z testów

Testy uruchamia się komendą `npm test` (przy działającym backendzie na porcie 3000):

```
$ npm test

Testy API IT Tinder

  ✓ POST /api/auth/register – rejestracja
  ✓ POST /api/auth/login – logowanie
  ✓ GET /api/oferty – lista ofert
  ✓ GET /api/oferty?tech=aws – filtrowanie
  ✓ GET /api/jobs – brak autoryzacji = 401
  ✓ GET /api/jobs – z tokenem
  ✓ GET /api/swipes/history – bez admina = 403
  ✓ GET /api/external/jobs – Remotive
  ✓ POST /api/auth/register – brak hasła = 400

Wyniki: 9 zaliczone, 0 błędów
```

**Pokrycie testowe:** 9 testów obejmujących: rejestrację, logowanie, listę ofert, filtrowanie,
ochronę endpointów, autoryzację rolą, integrację z zewnętrznym API i walidację serwerową.
Wymóg projektowy (≥ 5 testów) został przekroczony.

---

## 7. Mapowanie wymagań projektowych

| Wymaganie wg specyfikacji                                              | Realizacja                                  |
|------------------------------------------------------------------------|---------------------------------------------|
| Struktura katalogów `client/ server/ tests/`                           | `it-tinder/`                                |
| Repozytorium Git z historią                                            | GitHub: `rbartosz/PROJEKT_LABY`             |
| README.md z instrukcją                                                 | `README.md` + `it-tinder/README.md`         |
| Semantyczny HTML5                                                      | `<main>`, `<header>`, `<section>`, `<article>`, `<nav>`, `<footer>`, `<fieldset>` |
| CSS Flexbox/Grid + responsywność                                       | `client/styles.css` + media queries 768/480 |
| JS: zdarzenia, dynamiczny DOM, walidacja formularzy                    | React + regex email + min. długość hasła    |
| REST API ≥ 4 endpointy CRUD                                            | `/api/jobs` GET/POST/PUT/DELETE + auth + admin/users + swipes (12 endpointów) |
| Statusy HTTP, JSON, walidacja serwerowa                                | 200/201/400/401/403/404/500/502             |
| ≥ 3 tabele z PK i FK                                                   | `users`, `jobs`, `swipes`                   |
| JOIN i indeks                                                          | `/api/swipes/history` + 3 indeksy           |
| `schema.sql`                                                           | `server/schema.sql`                         |
| Rejestracja / logowanie z bcryptem                                     | `bcrypt.hash` w `/api/auth/register`        |
| Sesja                                                                  | JWT z 24h ważnością                         |
| Role user/admin + chronione endpointy                                  | Middleware `authenticateToken` + `isAdmin`  |
| `fetch` + `async/await`                                                | Frontend axios + fetch w `App.jsx`          |
| Integracja z publicznym zewnętrznym API                                | Remotive (`/api/external/jobs` + przycisk frontendu) |
| ≥ 5 testów jednostkowych (`npm test`)                                  | 9 testów w `tests/api.test.js`              |
| `.env` (nie w kodzie) + `.env.example`                                 | `server/.env` (gitignored) + `server/.env.example` |
