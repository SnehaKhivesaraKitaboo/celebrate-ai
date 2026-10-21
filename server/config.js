const DEFAULT_PORT = 3000;
const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_TIMEOUT_MS = 30_000;

function parsePort(value) {
  const port = Number.parseInt(value ?? '', 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const apiKey = typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY.trim() : '';
  const model = typeof env.GEMINI_MODEL === 'string' && env.GEMINI_MODEL.trim() ? env.GEMINI_MODEL.trim() : DEFAULT_MODEL;
  return Object.freeze({
    port: parsePort(env.PORT),
    geminiApiKey: apiKey,
    geminiModel: model,
    aiTimeoutMs: parsePositiveInt(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    planRateMax: parsePositiveInt(env.PLAN_RATE_MAX, 10),
    planRateWindowMs: parsePositiveInt(env.PLAN_RATE_WINDOW_MS, 15 * 60 * 1000),
  });
}
