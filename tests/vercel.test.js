import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveConfiguredApiBase } from '../scripts/prepare-firebase-hosting.js';

const HOBBY_MAX_DURATION_SECONDS = 300;
const CLIENT_TIMEOUT_SECONDS = 40;

function listen(app) {
  const server = app.listen(0);
  return new Promise((resolve) => {
    server.once('listening', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test('Vercel Hobby allows the Gemini call to finish', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const maxDuration = config.functions?.['app.js']?.maxDuration;
  assert.equal(typeof maxDuration, 'number');
  assert.ok(maxDuration >= CLIENT_TIMEOUT_SECONDS);
  assert.ok(maxDuration <= HOBBY_MAX_DURATION_SECONDS);
  const source = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /GEMINI_API_KEY|AIza|sk-/);
});

test('the Vercel entry keeps the existing API paths and does not listen', async () => {
  const entry = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const localServer = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(entry, /export default app/);
  assert.match(entry, /from 'express'/);
  assert.doesNotMatch(entry, /\.listen\(/);
  assert.match(localServer, /\.listen\(/);
  assert.doesNotMatch(entry, /GEMINI_API_KEY|AIza/);

  const { default: app } = await import('../app.js');
  const { server, baseUrl } = await listen(app);
  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const plan = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    });
    assert.equal(plan.status, 400);
    assert.equal((await plan.json()).code, 'invalid_event');

    const replan = await fetch(`${baseUrl}/api/replan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    });
    assert.equal(replan.status, 400);
    assert.equal((await replan.json()).code, 'invalid_event');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('a Vercel https origin is the API base written for Firebase Hosting', () => {
  assert.equal(
    resolveConfiguredApiBase({ API_BASE_URL: 'https://celebrate-ai.vercel.app/api/plan' }, 'GEMINI_API_KEY=server-only-secret'),
    'https://celebrate-ai.vercel.app',
  );
});
