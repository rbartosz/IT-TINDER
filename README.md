# PROJEKT_LABY – IT Tinder

Aplikacja webowa w stylu Tindera, ale do ofert pracy IT – przesuwasz w prawo, żeby zapisać ofertę,
w lewo, żeby pominąć. Filtrujesz po technologiach, logujesz się, a admin zarządza użytkownikami i ofertami.

## Lokalizacja kodu

Cały kod aplikacji znajduje się w katalogu [`it-tinder/`](./it-tinder/).

```
PROJEKT_LABY/
└── it-tinder/
    ├── client/   # Frontend React + Vite
    ├── server/   # Backend Express + SQLite
    ├── scraper/  # Pobieranie ofert z Remotive API
    └── tests/    # Testy jednostkowe API
```

## start

```bash
cd it-tinder

# instalacja
npm install
cd server && npm install && cd ..

# konfiguracja env (skopiuj i edytuj wg potrzeb)
cp server/.env.example server/.env

# Terminal 1 – backend (port 3000)
npm run server

# Terminal 2 – frontend (port 5173)
npm run dev
```

Pełna instrukcja, opis API i struktury: [`it-tinder/README.md`](./it-tinder/README.md).

Dokumentacja: [`it-tinder/DOKUMENTACJA.md`](./it-tinder/DOKUMENTACJA.md).
