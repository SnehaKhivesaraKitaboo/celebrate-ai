import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';

const WEB_APP = 'https://celebrate-ai-promptwars.web.app';
const FIREBASE_APP = 'https://celebrate-ai-promptwars.firebaseapp.com';

function listen(app) {
  const server = app.listen(0);
  return new Promise((resolve) => {
    server.once('listening', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test('loadConfig keeps only the two Firebase Hosting origins', () => {
  const config = loadConfig({
    ALLOWED_ORIGINS: `${WEB_APP}, https://evil.example, *, ${FIREBASE_APP}, ${WEB_APP}`,
  });
  assert.deepEqual(config.allowedOrigins, [WEB_APP, FIREBASE_APP]);
  assert.deepEqual(loadConfig({}).allowedOrigins, []);
  assert.deepEqual(loadConfig({ ALLOWED_ORIGINS: 'http://localhost:3000' }).allowedOrigins, []);
});

test('preflight and API responses allow the configured Hosting origins', async () => {
  const app = createApp({
    config: loadConfig({ ALLOWED_ORIGINS: `${WEB_APP},${FIREBASE_APP}` }),
  });
  const { server, baseUrl } = await listen(app);
  try {
    const preflight = await fetch(`${baseUrl}/api/plan`, {
      method: 'OPTIONS',
      headers: {
        Origin: WEB_APP,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, accept',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), WEB_APP);
    assert.match(preflight.headers.get('access-control-allow-methods'), /\bPOST\b/);
    assert.match(preflight.headers.get('access-control-allow-headers'), /content-type/i);
    assert.match(preflight.headers.get('access-control-allow-headers'), /\baccept\b/i);
    assert.match(preflight.headers.get('vary'), /\borigin\b/i);
    assert.equal(preflight.headers.get('cross-origin-resource-policy'), 'cross-origin');

    const health = await fetch(`${baseUrl}/api/health`, { headers: { Origin: FIREBASE_APP } });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('access-control-allow-origin'), FIREBASE_APP);
    assert.equal(health.headers.get('cross-origin-resource-policy'), 'cross-origin');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('CORS fails closed for missing, local, and unknown origins', async () => {
  const app = createApp({
    config: loadConfig({ ALLOWED_ORIGINS: `${WEB_APP},https://evil.example` }),
  });
  const { server, baseUrl } = await listen(app);
  try {
    const unknown = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(unknown.headers.get('access-control-allow-origin'), null);

    const local = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(local.headers.get('access-control-allow-origin'), null);

    const sameOrigin = await fetch(`${baseUrl}/api/health`);
    assert.equal(sameOrigin.headers.get('access-control-allow-origin'), null);
    assert.equal(sameOrigin.headers.get('cross-origin-resource-policy'), 'cross-origin');

    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.headers.get('cross-origin-resource-policy'), 'same-origin');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
