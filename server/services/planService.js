import { toISODate } from '../../shared/dates.js';
import { normalizePlan, REPLAN_RESPONSE_SCHEMA } from '../../shared/planSchema.js';
import { cleanChange, finalizeReplan } from '../../shared/replan.js';
import { AppError } from '../errors.js';
import { buildPlanPrompt } from '../prompts/planPrompt.js';
import { buildReplanPrompt } from '../prompts/replanPrompt.js';
import { createGeminiClient } from './geminiClient.js';

function parseModelJson(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function isTimeout(err, signal) {
  return signal.aborted || err?.name === 'TimeoutError' || err?.name === 'AbortError';
}

export async function requestModelPlan(event, client, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  let text;
  try {
    text = await client.generateJson(buildPlanPrompt(event), signal);
  } catch (err) {
    if (isTimeout(err, signal)) {
      throw new AppError(504, 'The planning request timed out. Please try again.', 'timeout');
    }
    throw new AppError(502, 'The planning service is unavailable. Please try again.', 'unavailable');
  }

  const parsed = parseModelJson(text);
  if (!parsed) {
    console.error('AI plan rejected: unparseable');
    throw new AppError(502, 'The planner returned an unusable response. Please try again.', 'invalid_response');
  }
  const normalized = normalizePlan(parsed, event);
  if (!normalized.ok) {
    console.error(`AI plan rejected: ${normalized.reason}`);
    throw new AppError(502, 'The planner returned an unusable response. Please try again.', 'invalid_response');
  }
  return normalized.plan;
}

async function requestRevision(event, plan, change, client, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  let text;
  try {
    text = await client.generateJson(buildReplanPrompt(event, plan, change), signal, REPLAN_RESPONSE_SCHEMA);
  } catch (err) {
    if (isTimeout(err, signal)) {
      throw new AppError(504, 'The planning request timed out. Please try again.', 'timeout');
    }
    throw new AppError(502, 'The planning service is unavailable. Please try again.', 'unavailable');
  }
  const parsed = parseModelJson(text);
  const revised = parsed ? finalizeReplan(event, plan, parsed, change, toISODate(new Date())) : null;
  if (!revised?.ok) {
    console.error(`AI replan rejected: ${revised?.reason ?? 'unparseable'}`);
    throw new AppError(502, 'The planner returned an unusable response. Please try again.', 'invalid_response');
  }
  return revised;
}

export function createPlanService(config, client = null) {
  const gemini = client ?? (config.geminiApiKey
    ? createGeminiClient({ apiKey: config.geminiApiKey, model: config.geminiModel })
    : null);
  return {
    createPlan(event) {
      if (!gemini) {
        throw new AppError(503, 'AI planning is not configured on this server.', 'not_configured');
      }
      return requestModelPlan(event, gemini, config.aiTimeoutMs);
    },
    replan(event, plan, change) {
      const request = cleanChange(change);
      if (!request) throw new AppError(400, 'Describe the change you want.', 'invalid_change');
      if (!gemini) throw new AppError(503, 'AI planning is not configured on this server.', 'not_configured');
      return requestRevision(event, plan, request, gemini, config.aiTimeoutMs);
    },
  };
}
