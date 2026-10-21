import { summarizeBudget, roundMoney } from './budget.js';
import { deadlineFor, deadlineStatus } from './timeline.js';
import { validateEvent } from './eventValidation.js';
import { normalizePlan } from './planSchema.js';

const EVENT_FIELDS = Object.freeze(['budget', 'theme', 'eventDate', 'city', 'guestCount', 'dietaryPreferences']);
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function amount(raw) {
  const value = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) return null;
  return roundMoney(value);
}

/** Numbers the user stated explicitly. These override the model's event fields. */
export function explicitConstraints(text, event) {
  const source = typeof text === 'string' ? text : '';
  const locks = {};
  const amounts = [];
  for (const match of source.matchAll(/(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi)) {
    const value = amount(match[1]);
    if (value != null) amounts.push(value);
  }
  for (const match of source.matchAll(/budget(?:\s+\w+){0,6}\s*(?:to|of|at|is)?\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi)) {
    if (source[match.index + match[0].length] === '%') continue;
    const value = amount(match[1]);
    if (value != null) amounts.push(value);
  }
  if (amounts.length) locks.budget = amounts[amounts.length - 1];

  const percent = /budget by\s+(\d+(?:\.\d+)?)\s*%/i.exec(source);
  if (!Object.hasOwn(locks, 'budget') && percent) {
    const pct = Number(percent[1]);
    if (pct > 0 && pct < 100) locks.budget = roundMoney(event.budget * (1 - pct / 100));
  }

  const guestKeep = /keep(?:ing)?\s+(?:the\s+)?(\d+)\s+guests/i.exec(source);
  if (guestKeep) locks.guestCount = Number(guestKeep[1]);
  else if (/guest(?:s| count).{0,40}(?:same|unchanged|stays|remains)/i.test(source) || /(?:same|unchanged|keep).{0,40}guest/i.test(source)) {
    locks.guestCount = event.guestCount;
  }
  return locks;
}

export function cleanChange(value) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, '').trim().replace(/[ \t]+/g, ' ').slice(0, 500);
}

export function applyEventChanges(event, changes, locks = {}) {
  const next = { ...event };
  const source = changes && typeof changes === 'object' && !Array.isArray(changes) ? changes : {};
  for (const key of EVENT_FIELDS) {
    if (Object.hasOwn(source, key)) next[key] = source[key];
  }
  if (Object.hasOwn(locks, 'budget')) next.budget = locks.budget;
  if (Object.hasOwn(locks, 'guestCount')) next.guestCount = locks.guestCount;
  const validated = validateEvent(next, { allowPast: next.eventDate === event.eventDate });
  return validated.valid ? { ok: true, event: validated.value } : { ok: false, errors: validated.errors };
}

export function mergePlan(previous, next) {
  const actuals = new Map((previous?.budget?.items ?? []).map((item) => [item.id, item.actual ?? null]));
  const completed = new Map((previous?.timeline ?? []).map((task) => [task.id, task.completed === true]));
  const quotes = new Map((previous?.vendorChecklist ?? []).map((vendor) => [vendor.id, vendor.quotes ?? []]));
  const items = next.budget.items.map((item) => ({ ...item, actual: actuals.has(item.id) ? actuals.get(item.id) : null }));
  const timeline = next.timeline.map((task) => ({ ...task, completed: completed.get(task.id) === true }));
  const vendorChecklist = next.vendorChecklist.map((vendor) => ({
    ...vendor,
    quotes: quotes.get(vendor.id) ?? [],
  }));
  return { ...next, budget: { ...next.budget, items }, timeline, vendorChecklist };
}

function withTotals(plan, event) {
  const totals = summarizeBudget(plan.budget.items, event.budget);
  return {
    ...plan,
    budget: {
      ...plan.budget,
      currency: event.currency,
      total: event.budget,
      allocated: totals.allocated,
      difference: totals.difference,
    },
  };
}

export function diffPlan(beforeEvent, afterEvent, beforePlan, afterPlan) {
  const changes = [];
  const fields = [
    ['Budget', beforeEvent.budget, afterEvent.budget],
    ['Guests', beforeEvent.guestCount, afterEvent.guestCount],
    ['City', beforeEvent.city, afterEvent.city],
    ['Date', beforeEvent.eventDate, afterEvent.eventDate],
    ['Theme', beforeEvent.theme || 'Not specified', afterEvent.theme || 'Not specified'],
  ];
  for (const [area, before, after] of fields) {
    if (before !== after) changes.push({ area, before, after });
  }
  const beforeItems = new Map(beforePlan.budget.items.map((item) => [item.id, item]));
  const afterItems = new Map(afterPlan.budget.items.map((item) => [item.id, item]));
  for (const [id, item] of afterItems) {
    const previous = beforeItems.get(id);
    if (!previous) changes.push({ area: item.category, before: null, after: item.estimated });
    else if (previous.estimated !== item.estimated) changes.push({ area: item.category, before: previous.estimated, after: item.estimated });
  }
  for (const [id, item] of beforeItems) {
    if (!afterItems.has(id)) changes.push({ area: item.category, before: item.estimated, after: null });
  }
  return changes;
}

export function findConflicts(event, plan, today) {
  const conflicts = [];
  const totals = summarizeBudget(plan.budget.items, event.budget);
  if (totals.estimatesOver) conflicts.push({ type: 'estimates_over', amount: totals.difference });
  if (totals.actualOver) conflicts.push({ type: 'actual_over', amount: roundMoney(totals.actual - event.budget) });
  for (const task of plan.timeline) {
    if (task.completed) continue;
    const deadline = deadlineFor(event.eventDate, task.daysBeforeEvent);
    if (deadlineStatus(today, deadline) === 'overdue') conflicts.push({ type: 'overdue', taskId: task.id, title: task.title });
  }
  return conflicts;
}

function readNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).flatMap((note) => {
    if (!note || typeof note !== 'object') return [];
    const area = typeof note.area === 'string' ? note.area.trim() : '';
    const before = typeof note.before === 'string' ? note.before.trim() : '';
    const after = typeof note.after === 'string' ? note.after.trim() : '';
    const reason = typeof note.reason === 'string' ? note.reason.trim() : '';
    if (!area || !before || !after || !reason) return [];
    return [{ area: area.slice(0, 80), before: before.slice(0, 200), after: after.slice(0, 200), reason: reason.slice(0, 300) }];
  });
}

function readInfeasible(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => typeof item === 'string' && item.trim())
    .slice(0, 6)
    .map((item) => item.trim().slice(0, 300));
}

/**
 * Applies a model revision. Explicit numbers in the request win over eventChanges.
 * Actual costs, completed tasks, and quotations stay on matching ids.
 */
export function finalizeReplan(currentEvent, currentPlan, raw, change, today) {
  const locks = explicitConstraints(change, currentEvent);
  const applied = applyEventChanges(currentEvent, raw?.eventChanges, locks);
  if (!applied.ok) return { ok: false, reason: 'event_changes', plan: null };
  const normalized = normalizePlan(raw, applied.event);
  if (!normalized.ok) return normalized;
  const plan = withTotals(mergePlan(currentPlan, normalized.plan), applied.event);
  return {
    ok: true,
    reason: null,
    event: applied.event,
    plan,
    changes: diffPlan(currentEvent, applied.event, currentPlan, plan),
    notes: readNotes(raw?.changeSummary),
    infeasible: readInfeasible(raw?.infeasible),
    conflicts: findConflicts(applied.event, plan, today),
  };
}

/** Checks a replan response again in the browser before saving it. */
export function acceptReplan(currentEvent, currentPlan, response, change, today) {
  if (!response?.plan || !response?.event) return { ok: false, reason: 'invalid_response' };
  const locks = explicitConstraints(change, currentEvent);
  const eventCheck = validateEvent(response.event, { allowPast: response.event.eventDate === currentEvent.eventDate });
  if (!eventCheck.valid) return { ok: false, reason: 'event' };
  if (Object.hasOwn(locks, 'budget') && eventCheck.value.budget !== locks.budget) return { ok: false, reason: 'budget_lock' };
  if (Object.hasOwn(locks, 'guestCount') && eventCheck.value.guestCount !== locks.guestCount) return { ok: false, reason: 'guest_lock' };
  const normalized = normalizePlan(response.plan, eventCheck.value);
  if (!normalized.ok) return { ok: false, reason: normalized.reason };
  const plan = withTotals(mergePlan(currentPlan, normalized.plan), eventCheck.value);
  return {
    ok: true,
    event: eventCheck.value,
    plan,
    changes: diffPlan(currentEvent, eventCheck.value, currentPlan, plan),
    notes: readNotes(response.notes),
    infeasible: readInfeasible(response.infeasible),
    conflicts: findConflicts(eventCheck.value, plan, today),
  };
}

export function compareQuotes(quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return { count: 0, lowest: [], min: null };
  const min = Math.min(...quotes.map((quote) => quote.amount));
  return { count: quotes.length, lowest: quotes.filter((quote) => quote.amount === min), min };
}
