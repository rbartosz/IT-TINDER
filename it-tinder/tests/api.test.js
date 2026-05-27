// testy API - musi byc odpalony backend na porcie 3000 zeby przeszly
// odpalasz: npm test (z roota it-tinder/)

const BASE = 'http://localhost:3000';
// losowy email zeby kazde uruchomienie testow nie zapychalo bazy duplikatami
const testEmail = `test${Date.now()}@test.pl`;
let passed = 0;
let failed = 0;

// prosty helper - wypisuje OK albo blad i zlicza wyniki
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('Testy API IT Tinder\n');

  // sprawdzam czy mozna sie zarejestrowac (status 201)
  await test('POST /api/auth/register – rejestracja', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'test123' }),
    });
    const data = await res.json();
    if (res.status !== 201) throw new Error(data.error || `status ${res.status}`);
  });

  // logowanie - po nim zapisuje token do dalszych testow
  let token;
  await test('POST /api/auth/login – logowanie', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'test123' }),
    });
    const data = await res.json();
    if (res.status !== 200) throw new Error(data.error || `status ${res.status}`);
    if (!data.token) throw new Error('brak tokena');
    token = data.token;
  });

  // czy oferty z JSON-a sie pobieraja
  await test('GET /api/oferty – lista ofert', async () => {
    const res = await fetch(`${BASE}/api/oferty`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('odpowiedz nie jest tablica');
  });

  // filtrowanie po techu - tu tylko sprawdzam ze nie wybucha
  await test('GET /api/oferty?tech=aws – filtrowanie', async () => {
    const res = await fetch(`${BASE}/api/oferty?tech=aws`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
  });

  // chroniony endpoint - bez tokena ma rzucic 401
  await test('GET /api/jobs – brak autoryzacji = 401', async () => {
    const res = await fetch(`${BASE}/api/jobs`);
    if (res.status !== 401) throw new Error(`oczekiwano 401, dostalem ${res.status}`);
  });

  // ten sam endpoint z tokenem - powinno przejsc
  await test('GET /api/jobs – z tokenem', async () => {
    const res = await fetch(`${BASE}/api/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) throw new Error(`status ${res.status}`);
  });

  // historia swipy - tylko admin moze, zwykly user dostaje 403
  await test('GET /api/swipes/history – bez admina = 403', async () => {
    const res = await fetch(`${BASE}/api/swipes/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 403) throw new Error(`oczekiwano 403, dostalem ${res.status}`);
  });

  // walidacja po stronie servera - bez hasla ma byc 400 - bez hasla ma byc 400
  await test('POST /api/auth/register – brak hasła = 400', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@x.pl' }),
    });
    if (res.status !== 400) throw new Error(`oczekiwano 400, dostalem ${res.status}`);
  });

  console.log(`\nWyniki: ${passed} zaliczone, ${failed} bledow`);
  // jak cos sie wyjebalo to exit 1 zeby CI sie wywalil
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Testy przerwane:', err.message);
  process.exit(1);
});
