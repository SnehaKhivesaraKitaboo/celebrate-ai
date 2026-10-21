import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('unknown API routes return a JSON 404', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found.' });
});

test('malformed JSON bodies get a generic 400', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'The request could not be processed.' });
});

test('serves the frontend and shared modules', async () => {
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<form class="panel event-form" id="event-form" novalidate>/);

  const shared = await fetch(`${baseUrl}/shared/eventValidation.js`);
  assert.equal(shared.status, 200);
  assert.match(shared.headers.get('content-type'), /javascript/);
});

test('sends security headers and hides the framework', async () => {
  const res = await fetch(`${baseUrl}/`);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*cdn\.jsdelivr\.net/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('loadConfig falls back to the default port for invalid values', () => {
  assert.equal(loadConfig({ PORT: '8080' }).port, 8080);
  assert.equal(loadConfig({ PORT: 'abc' }).port, 3000);
  assert.equal(loadConfig({}).port, 3000);
});
