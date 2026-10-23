import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestPlan, requestReplan } from '../public/js/api.js';
import { sampleEvent, samplePlanRaw } from './samplePlan.js';
import {
  apiConfigModuleSource,
  cspWithApiOrigin,
  firebaseConfigWithApiOrigin,
  resolveConfiguredApiBase,
} from '../scripts/prepare-firebase-hosting.js';

const CSP = "default-src 'self'; connect-src 'self'; font-src 'self'";

test('the dashboard calls Firebase AI Logic and does not embed a Gemini key', () => {
  const api = readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8');
  const planner = readFileSync(new URL('../public/js/planner.js', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../public/js/firebasePublicConfig.js', import.meta.url), 'utf8');
  assert.match(planner, /GoogleAIBackend/);
  assert.doesNotMatch(`${api}\n${planner}\n${config}`, /GEMINI_API_KEY|AgentPlatformBackend|VertexAIBackend|\/api\/plan/);
});

test('request helpers use the injected model client', async () => {
  const seen = [];
  const client = {
    async generateJson(prompt) {
      seen.push(prompt.slice(0, 12));
      return '{}';
    },
  };
  await assert.rejects(() => requestPlan(sampleEvent, { client }), /unusable/);
  await assert.rejects(() => requestReplan(sampleEvent, samplePlanRaw(), 'smaller budget', { client }), /unusable/);
  assert.equal(seen.length, 2);
});

test('API base comes from the environment and stays out of the CSP until it is set', () => {
  const file = [
    'GEMINI_API_KEY=server-only-secret',
    'API_BASE_URL=https://svc.onrender.com/ignored',
  ].join('\n');
  assert.equal(resolveConfiguredApiBase({}, file), 'https://svc.onrender.com');
  assert.equal(resolveConfiguredApiBase({ API_BASE_URL: 'https://from-env.onrender.com' }, file), 'https://from-env.onrender.com');
  assert.equal(resolveConfiguredApiBase({}, 'GEMINI_API_KEY=server-only-secret'), '');
  assert.equal(cspWithApiOrigin(CSP, ''), CSP);
  assert.equal(cspWithApiOrigin(CSP, 'https://svc.onrender.com'), "default-src 'self'; connect-src 'self' https://svc.onrender.com; font-src 'self'");
  assert.equal(
    cspWithApiOrigin(cspWithApiOrigin(CSP, 'https://svc.onrender.com'), 'https://svc.onrender.com'),
    "default-src 'self'; connect-src 'self' https://svc.onrender.com; font-src 'self'",
  );
});

test('generated hosting config contains only the public API origin', () => {
  const source = apiConfigModuleSource('https://svc.onrender.com');
  assert.match(source, /export const API_BASE = "https:\/\/svc\.onrender\.com"/);
  assert.doesNotMatch(source, /GEMINI|secret|AIza/);
  assert.equal(apiConfigModuleSource(''), "export const API_BASE = '';\n");
  assert.throws(() => resolveConfiguredApiBase({ API_BASE_URL: 'http://svc.onrender.com' }, ''), /https/);
});

test('firebase.json connect-src is updated in place when the origin is known', () => {
  const sample = `{
  "hosting": {
    "headers": [{
      "headers": [{
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; connect-src 'self'; font-src 'self'"
      }]
    }]
  }
}
`;
  const next = firebaseConfigWithApiOrigin(sample, 'https://svc.onrender.com');
  assert.match(next, /connect-src 'self' https:\/\/svc\.onrender\.com/);
  assert.equal(firebaseConfigWithApiOrigin(next, 'https://svc.onrender.com'), next);
  assert.equal(firebaseConfigWithApiOrigin(sample, ''), sample);
});

test('committed Hosting CSP has no backend origin yet', () => {
  const json = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const csp = json.hosting.headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value;
  assert.match(csp, /connect-src 'self' https:\/\/firebasevertexai\.googleapis\.com/);
  assert.match(csp, /https:\/\/content-firebaseappcheck\.googleapis\.com/);
  assert.doesNotMatch(csp, /onrender\.com|localhost|vercel\.app|generativelanguage\.googleapis\.com/);
});
