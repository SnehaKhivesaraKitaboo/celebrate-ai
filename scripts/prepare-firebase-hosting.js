import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'hosting-dist');

export function parseApiBaseUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('API_BASE_URL must be an absolute https URL');
  }
  if (url.protocol !== 'https:') throw new Error('API_BASE_URL must use https');
  if (url.username || url.password) throw new Error('API_BASE_URL must not contain credentials');
  if (url.search || url.hash) throw new Error('API_BASE_URL must not include a query or hash');
  return url.origin;
}

export function apiBaseFromEnvText(text) {
  if (typeof text !== 'string' || !text) return '';
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    if (trimmed.slice(0, eq).trim() !== 'API_BASE_URL') continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return '';
}

/** Process environment wins. Only API_BASE_URL is read from env text. */
export function resolveConfiguredApiBase(env = {}, envFileText = '') {
  const fromEnv = typeof env.API_BASE_URL === 'string' ? env.API_BASE_URL.trim() : '';
  return parseApiBaseUrl(fromEnv || apiBaseFromEnvText(envFileText));
}

export function cspWithApiOrigin(csp, origin) {
  if (!origin) return csp;
  if (!csp.includes('connect-src ')) throw new Error('Content-Security-Policy has no connect-src');
  return csp.replace(/connect-src [^;"]+/, `connect-src 'self' ${origin}`);
}

export function apiConfigModuleSource(origin) {
  const value = origin ? JSON.stringify(origin) : "''";
  return `export const API_BASE = ${value};\n`;
}

export function firebaseConfigWithApiOrigin(text, origin) {
  if (!origin) return text;
  const json = JSON.parse(text);
  const groups = json.hosting?.headers ?? [];
  let current = '';
  for (const group of groups) {
    for (const header of group.headers ?? []) {
      if (header.key === 'Content-Security-Policy') current = header.value;
    }
  }
  if (!current) throw new Error('firebase.json has no Content-Security-Policy');
  if (current.includes(origin)) return text;
  const updated = cspWithApiOrigin(current, origin);
  const index = text.indexOf(current);
  if (index < 0) throw new Error('Content-Security-Policy value was not found in firebase.json');
  return text.slice(0, index) + updated + text.slice(index + current.length);
}

function readEnvText() {
  const envPath = path.join(root, '.env');
  return fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
}

function main() {
  const origin = resolveConfiguredApiBase(process.env, readEnvText());
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'public'), destination, { recursive: true });
  fs.cpSync(path.join(root, 'shared'), path.join(destination, 'shared'), { recursive: true });
  if (!origin) return;

  fs.writeFileSync(path.join(destination, 'js', 'apiConfig.js'), apiConfigModuleSource(origin));
  const firebasePath = path.join(root, 'firebase.json');
  const current = fs.readFileSync(firebasePath, 'utf8');
  const next = firebaseConfigWithApiOrigin(current, origin);
  if (next !== current) fs.writeFileSync(firebasePath, next);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) main();
