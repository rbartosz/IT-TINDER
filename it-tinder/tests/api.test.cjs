// Testy jednostkowe logiki serwerowej
// Odpalasz: npm test (z roota it-tinder/)
// NIE wymaga uruchomionego serwera - testuje czystą logikę

const path = require('path');
const jwt = require(path.join(__dirname, '..', 'server', 'node_modules', 'jsonwebtoken'));
const { parseSalary, authenticateToken, isAdmin, JWT_SECRET } = require(path.join(__dirname, '..', 'server', 'server.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) throw new Error(`${msg} oczekiwano ${expected}, dostano ${actual}`);
}

// --- parseSalary ---

console.log('\nparseSalary:');

test('parseSalary – null zwraca domyślne wartości', () => {
  const result = parseSalary(null);
  assertEqual(result.min, 5000);
  assertEqual(result.max, 10000);
});

test('parseSalary – parsuje zakres z "k"', () => {
  const result = parseSalary('$50k - $80k');
  assertEqual(result.min, Math.round(50000 * 3.8 / 12));
  assertEqual(result.max, Math.round(80000 * 3.8 / 12));
});

// --- authenticateToken ---

console.log('\nauthenticateToken:');

test('authenticateToken – brak nagłówka Authorization zwraca 401', () => {
  let statusCode, responseBody;
  const req = { headers: {} };
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { responseBody = body; }
  };
  const next = () => { throw new Error('next() nie powinno być wywołane'); };
  authenticateToken(req, res, next);
  assertEqual(statusCode, 401);
});

test('authenticateToken – nieprawidłowy token zwraca 403', () => {
  let statusCode;
  const req = { headers: { authorization: 'Bearer zly_token_123' } };
  const res = {
    status(code) { statusCode = code; return this; },
    json() {}
  };
  const next = () => { throw new Error('next() nie powinno być wywołane'); };
  authenticateToken(req, res, next);
  assertEqual(statusCode, 403);
});

test('authenticateToken – prawidłowy token wywołuje next()', () => {
  const token = jwt.sign({ id: 1, email: 'test@test.pl', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
  let nextCalled = false;
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    status() { return this; },
    json() {}
  };
  const next = () => { nextCalled = true; };
  authenticateToken(req, res, next);
  if (!nextCalled) throw new Error('next() powinno być wywołane');
  assertEqual(req.user.email, 'test@test.pl');
});

// --- isAdmin ---

console.log('\nisAdmin:');

test('isAdmin – user bez roli admin dostaje 403', () => {
  let statusCode;
  const req = { user: { role: 'user' } };
  const res = {
    status(code) { statusCode = code; return this; },
    json() {}
  };
  const next = () => { throw new Error('next() nie powinno być wywołane'); };
  isAdmin(req, res, next);
  assertEqual(statusCode, 403);
});

test('isAdmin – admin przechodzi dalej (next)', () => {
  let nextCalled = false;
  const req = { user: { role: 'admin' } };
  const res = {
    status() { return this; },
    json() {}
  };
  const next = () => { nextCalled = true; };
  isAdmin(req, res, next);
  if (!nextCalled) throw new Error('next() powinno być wywołane');
});

// --- Podsumowanie ---

console.log(`\nWyniki: ${passed} zaliczone, ${failed} błędów`);
if (failed > 0) process.exit(1);
