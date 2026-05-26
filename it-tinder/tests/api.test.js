// Prosty test API – uruchom gdy backend działa na porcie 3000
// node tests/api.test.js

const BASE = 'http://localhost:3000';
const testEmail = `test${Date.now()}@test.pl`;
let passed = 0;
let failed = 0;

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

  // Test: rejestracja
  await test('POST /api/auth/register – rejestracja', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'test123' }),
    });
    const data = await res.json();
    if (res.status !== 201) throw new Error(data.error || `status ${res.status}`);
  });

  // Test: logowanie
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

  // Test: oferty JSON
  await test('GET /api/oferty – lista ofert', async () => {
    const res = await fetch(`${BASE}/api/oferty`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('odpowiedź nie jest tablicą');
  });

  // Test: oferty z filtrowaniem
  await test('GET /api/oferty?tech=aws – filtrowanie', async () => {
    const res = await fetch(`${BASE}/api/oferty?tech=aws`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
  });

  // Test: chroniony endpoint bez tokena
  await test('GET /api/jobs – brak autoryzacji = 401', async () => {
    const res = await fetch(`${BASE}/api/jobs`);
    if (res.status !== 401) throw new Error(`oczekiwano 401, dostałem ${res.status}`);
  });

  // Test: chroniony endpoint z tokenem
  await test('GET /api/jobs – z tokenem', async () => {
    const res = await fetch(`${BASE}/api/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) throw new Error(`status ${res.status}`);
  });

  // Test: endpoint z JOIN (wymaga admina – sprawdzamy czy blokuje)
  await test('GET /api/swipes/history – bez admina = 403', async () => {
    const res = await fetch(`${BASE}/api/swipes/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 403) throw new Error(`oczekiwano 403, dostałem ${res.status}`);
  });

  // Test: zewnętrzne API Remotive
  await test('GET /api/external/jobs – Remotive', async () => {
    const res = await fetch(`${BASE}/api/external/jobs`);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('odpowiedź nie jest tablicą');
    if (data.length === 0) throw new Error('pusta odpowiedź z API');
  });

  // Test: walidacja – brakujące pola
  await test('POST /api/auth/register – brak hasła = 400', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@x.pl' }),
    });
    if (res.status !== 400) throw new Error(`oczekiwano 400, dostałem ${res.status}`);
  });

  console.log(`\nWyniki: ${passed} zaliczone, ${failed} błędów`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Testy przerwane:', err.message);
  process.exit(1);
});
