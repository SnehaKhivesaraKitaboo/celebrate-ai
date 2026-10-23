import { toISODate } from '../../shared/dates.js';
import { normalizePlan } from '../../shared/planSchema.js';
import { buildPlanPrompt } from '../../shared/planPrompt.js';
import { buildReplanPrompt } from '../../shared/replanPrompt.js';
import { cleanChange, finalizeReplan } from '../../shared/replan.js';
import { createPlanner, firebaseReady } from './planner.js';

const FALLBACK = Object.freeze({
  not_configured: 'AI planning is not configured on this server.',
  timeout: 'The planning request timed out. Please try again.',
  unavailable: 'The planning service is unavailable. Please try again.',
  invalid_response: 'The planner returned an unusable response. Please try again.',
  rate_limited: 'Too many planning requests. Please wait and try again.',
});

export class PlanRequestError extends Error {
  constructor(message, { status = 0, code = '', fields = null } = {}) {
    super(message);
    this.name = 'PlanRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function parseModelJson(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function mapProviderError(err) {
  const name = err?.name ?? '';
  const code = String(err?.code ?? err?.status ?? '');
  const message = String(err?.message ?? '');
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|deadline/i.test(message)) {
    return new PlanRequestError(FALLBACK.timeout, { code: 'timeout' });
  }
  if (code === '429' || /resource-exhausted|quota|too many/i.test(message)) {
    return new PlanRequestError(FALLBACK.rate_limited, { code: 'rate_limited' });
  }
  return new PlanRequestError(FALLBACK.unavailable, { code: 'unavailable' });
}

function plannerFor(client) {
  if (client) return client;
  if (!firebaseReady()) return null;
  return createPlanner();
}

/** Asks Firebase AI Logic for a plan. Never invents one when the request fails. */
export async function requestPlan(event, { client, timeoutMs = 40_000 } = {}) {
  const planner = plannerFor(client);
  if (!planner) throw new PlanRequestError(FALLBACK.not_configured, { code: 'not_configured' });
  let text;
  try {
    text = await planner.generateJson(buildPlanPrompt(event), { schema: 'plan', timeoutMs });
  } catch (err) {
    throw mapProviderError(err);
  }
  const normalized = normalizePlan(parseModelJson(text), event);
  if (!normalized.ok) throw new PlanRequestError(FALLBACK.invalid_response, { code: 'invalid_response' });
  return normalized.plan;
}

/** Revises the current plan. A failure leaves the caller holding the previous plan. */
export async function requestReplan(event, plan, change, { client, timeoutMs = 40_000 } = {}) {
  const request = cleanChange(change);
  if (!request) throw new PlanRequestError('Describe the change you want.', { code: 'invalid_change' });
  const planner = plannerFor(client);
  if (!planner) throw new PlanRequestError(FALLBACK.not_configured, { code: 'not_configured' });
  let text;
  try {
    text = await planner.generateJson(buildReplanPrompt(event, plan, request), { schema: 'replan', timeoutMs });
  } catch (err) {
    throw mapProviderError(err);
  }
  const revised = finalizeReplan(event, plan, parseModelJson(text), request, toISODate(new Date()));
  if (!revised?.ok) throw new PlanRequestError(FALLBACK.invalid_response, { code: 'invalid_response' });
  return revised;
}
