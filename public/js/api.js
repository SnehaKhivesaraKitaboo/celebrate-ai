const FALLBACK = Object.freeze({
  not_configured: 'AI planning is not configured on this server.',
  timeout: 'The planning request timed out. Please try again.',
  unavailable: 'The planning service is unavailable. Please try again.',
  invalid_response: 'The planner returned an unusable response. Please try again.',
  rate_limited: 'Too many planning requests. Please wait and try again.',
  invalid_event: 'Check the event details.',
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

/** Sends event details to the server. Never invents a plan when the request fails. */
export async function requestPlan(event, { fetchImpl = fetch, timeoutMs = 40_000 } = {}) {
  let response;
  try {
    response = await fetchImpl('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new PlanRequestError(FALLBACK.timeout, { code: 'timeout' });
    }
    throw new PlanRequestError('The planning request failed. Please try again.', { code: 'unavailable' });
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : (FALLBACK[body.code] || 'The planning request failed. Please try again.');
    throw new PlanRequestError(message, { status: response.status, code: body.code || '', fields: body.fields ?? null });
  }
  if (!body.plan || typeof body.plan !== 'object') {
    throw new PlanRequestError(FALLBACK.invalid_response, { status: response.status, code: 'invalid_response' });
  }
  return body.plan;
}

/** Sends the current plan and one change. A failure leaves the caller holding the previous plan. */
export async function requestReplan(event, plan, change, { fetchImpl = fetch, timeoutMs = 40_000 } = {}) {
  let response;
  try {
    response = await fetchImpl('/api/replan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ event, plan, change }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new PlanRequestError(FALLBACK.timeout, { code: 'timeout' });
    }
    throw new PlanRequestError('The planning request failed. Please try again.', { code: 'unavailable' });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : (FALLBACK[body.code] || 'The planning request failed. Please try again.');
    throw new PlanRequestError(message, { status: response.status, code: body.code || '' });
  }
  if (!body.plan || !body.event) {
    throw new PlanRequestError(FALLBACK.invalid_response, { status: response.status, code: 'invalid_response' });
  }
  return body;
}
