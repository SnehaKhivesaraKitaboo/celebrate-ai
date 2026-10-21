import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createPlanService } from '../server/services/planService.js';
import { buildReplanPrompt } from '../server/prompts/replanPrompt.js';
import { normalizePlan } from '../shared/planSchema.js';
import { summarizeBudget } from '../shared/budget.js';
import { explicitConstraints, finalizeReplan, acceptReplan, compareQuotes, findConflicts } from '../shared/replan.js';
import { createStorage } from '../public/js/storage.js';
import { createStore } from '../public/js/store.js';
import { buildPlanModel } from '../public/js/views/planModel.js';
import { buildPrintSections } from '../public/js/views/planPrint.js';
import { samplePlanRaw } from './samplePlan.js';

const TODAY = '2026-10-21';
const CHANGE = 'Change the budget to ₹20,000 while keeping 50 guests.';

const birthday = Object.freeze({
  eventType: 'birthday',
  eventDate: '2027-06-01',
  city: 'Pune',
  guestCount: 50,
  budget: 25000,
  currency: 'INR',
  theme: 'Garden party',
  dietaryPreferences: [],
  specialRequirements: '',
});

function birthdayPlan() {
  const raw = samplePlanRaw();
  raw.budget.items[0].estimated = 10000;
  raw.budget.items[1].estimated = 10000;
  raw.budget.items[2].estimated = 5000;
  const plan = normalizePlan(raw, birthday).plan;
  plan.budget.items[0].actual = 2000;
  plan.timeline[0].completed = true;
  plan.vendorChecklist[0].quotes = [{ id: 'quote-hall', label: 'Quote A', amount: 9000, notes: 'Includes chairs' }];
  return normalizePlan(plan, birthday).plan;
}

function revisedRaw() {
  const raw = samplePlanRaw();
  raw.budget.items[0].estimated = 8000;
  raw.budget.items[1].estimated = 7000;
  raw.budget.items[2].estimated = 5000;
  raw.eventChanges = { budget: 15000, guestCount: 10 };
  raw.changeSummary = [{ area: 'Decor', before: 'Fresh flowers', after: 'Paper garlands', reason: 'Decor is reduced so catering can stay.' }];
  raw.infeasible = ['A live band does not fit the revised budget.'];
  return raw;
}

test('explicit budget and guest wording override the model', () => {
  assert.equal(explicitConstraints(CHANGE, birthday).budget, 20000);
  assert.equal(explicitConstraints(CHANGE, birthday).guestCount, 50);
  assert.equal(explicitConstraints('Reduce the budget by 20% and keep the guest count the same.', birthday).budget, 20000);
  assert.equal(explicitConstraints('Reduce the budget by 20% and keep the guest count the same.', birthday).guestCount, 50);
});

test('a budget cut keeps 50 guests, revises allocations, and preserves local edits', () => {
  const current = birthdayPlan();
  const revised = finalizeReplan(birthday, current, revisedRaw(), CHANGE, TODAY);
  assert.equal(revised.ok, true);
  assert.equal(revised.event.guestCount, 50);
  assert.equal(revised.event.budget, 20000);
  assert.equal(revised.event.city, 'Pune');
  assert.equal(revised.plan.budget.total, 20000);
  assert.equal(revised.plan.budget.allocated, 20000);
  assert.equal(revised.plan.budget.difference, 0);
  assert.equal(revised.plan.budget.items.find((item) => item.id === 'exp-venue').actual, 2000);
  assert.equal(revised.plan.timeline.find((task) => task.id === 'task-venue').completed, true);
  assert.equal(revised.plan.vendorChecklist[0].quotes[0].label, 'Quote A');
  assert.equal(revised.changes.some((change) => change.area === 'Guests'), false);
  assert.deepEqual(revised.changes.find((change) => change.area === 'Budget'), { area: 'Budget', before: 25000, after: 20000 });
  assert.equal(revised.notes[0].reason.includes('catering'), true);
  assert.equal(revised.infeasible.length, 1);
  const totals = summarizeBudget(revised.plan.budget.items, revised.event.budget);
  assert.equal(totals.actual, 2000);
  assert.equal(totals.remaining, 18000);
});

test('the replan prompt omits actual spending and quotations', () => {
  const prompt = buildReplanPrompt(birthday, birthdayPlan(), CHANGE);
  assert.match(prompt, /keeping 50 guests/);
  assert.match(prompt, /Omit guestCount/);
  assert.doesNotMatch(prompt, /Quote A/);
  assert.doesNotMatch(prompt, /"actual"/);
});

test('over-budget estimates and overdue tasks are conflicts', () => {
  const plan = birthdayPlan();
  plan.budget.items[0].estimated = 30000;
  const conflicts = findConflicts({ ...birthday, eventDate: '2026-10-25', budget: 25000 }, plan, TODAY);
  assert.ok(conflicts.some((conflict) => conflict.type === 'estimates_over'));
  assert.ok(conflicts.some((conflict) => conflict.type === 'overdue' && conflict.title === 'Send invitations'));
});

test('a response that drops the locked guest count is refused', () => {
  const current = birthdayPlan();
  const revised = finalizeReplan(birthday, current, revisedRaw(), CHANGE, TODAY);
  const tampered = { ...revised, event: { ...revised.event, guestCount: 10 } };
  assert.equal(acceptReplan(birthday, current, tampered, CHANGE, TODAY).ok, false);
});

test('quote comparison picks the lowest entered amount', () => {
  const result = compareQuotes([{ label: 'A', amount: 9000 }, { label: 'B', amount: 7500 }, { label: 'C', amount: 7500 }]);
  assert.equal(result.min, 7500);
  assert.deepEqual(result.lowest.map((quote) => quote.label), ['B', 'C']);
});

test('expense, completion, and quotation edits survive a reload', () => {
  const backend = { data: new Map() };
  const storage = createStorage({
    getItem: (key) => backend.data.get(key) ?? null,
    setItem: (key, value) => backend.data.set(key, String(value)),
    removeItem: (key) => backend.data.delete(key),
  });
  const store = createStore(storage);
  store.saveEvent(birthday, birthdayPlan());
  assert.equal(store.updateExpense('exp-venue', { estimated: 10000, actual: 4000 }), true);
  const task = store.getState().plan.timeline.find((item) => item.id === 'task-menu');
  assert.equal(store.updateTask(task.id, { ...task, completed: true }), true);
  assert.equal(store.setQuotes('ven-catering', [{ id: 'quote-1', label: 'Caterer note', amount: 6000, notes: '' }]), true);
  assert.equal(store.updateExpense('exp-venue', { estimated: -5, actual: 1 }), false);

  const restored = createStore(storage).getState();
  const totals = summarizeBudget(restored.plan.budget.items, restored.event.budget);
  assert.equal(restored.event.guestCount, 50);
  assert.equal(restored.plan.budget.items.find((item) => item.id === 'exp-venue').actual, 4000);
  assert.equal(totals.allocated, 25000);
  assert.equal(totals.actual, 4000);
  assert.equal(totals.remaining, 21000);
  assert.equal(restored.plan.timeline.find((item) => item.id === 'task-menu').completed, true);
  assert.equal(restored.plan.vendorChecklist.find((item) => item.id === 'ven-catering').quotes[0].label, 'Caterer note');
});

test('the printable summary includes guests, recalculated totals, and the budget change', () => {
  const revised = finalizeReplan(birthday, birthdayPlan(), revisedRaw(), CHANGE, TODAY);
  const model = buildPlanModel(revised.event, revised.plan, TODAY);
  const text = buildPrintSections(revised.event, model, revised, {
    currency: (amount, currency) => `${currency} ${amount}`,
    date: (value) => value,
  }).flatMap((section) => section.lines).join('\n');
  assert.match(text, /50 guests/);
  assert.match(text, /Welcome drinks in the garden/);
  assert.match(text, /Budget INR 20000/);
  assert.match(text, /Estimated total INR 20000/);
  assert.match(text, /Actual spending INR 2000/);
  assert.match(text, /Remaining INR 18000/);
  assert.match(text, /Budget: INR 25000 → INR 20000/);
});

test('POST /api/replan applies the demo budget cut and keeps the guest count', async () => {
  let prompt = '';
  const service = createPlanService({ geminiApiKey: 'server-only', aiTimeoutMs: 1000 }, {
    generateJson(received) {
      prompt = received;
      return JSON.stringify(revisedRaw());
    },
  });
  const server = createApp({
    config: { geminiApiKey: '', geminiModel: 'gemini-3.8-flash', aiTimeoutMs: 1000, planRateMax: 10, planRateWindowMs: 60000 },
    planService: service,
  }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/replan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: birthday, plan: birthdayPlan(), change: CHANGE }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.match(prompt, /50/);
    assert.doesNotMatch(prompt, /Quote A/);
    assert.equal(body.event.guestCount, 50);
    assert.equal(body.event.budget, 20000);
    assert.equal(body.plan.budget.allocated, 20000);
    assert.equal(body.plan.budget.items.find((item) => item.id === 'exp-venue').actual, 2000);
    assert.equal(summarizeBudget(body.plan.budget.items, body.event.budget).remaining, 18000);
    assert.equal(body.changes.some((change) => change.area === 'Guests'), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('replanning without a configured model does not invent a revision', async () => {
  const server = createApp({
    config: { geminiApiKey: '', geminiModel: 'gemini-3.8-flash', aiTimeoutMs: 1000, planRateMax: 10, planRateWindowMs: 60000 },
    planService: createPlanService({ geminiApiKey: '', aiTimeoutMs: 1000 }),
  }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/replan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: birthday, plan: birthdayPlan(), change: CHANGE }),
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.code, 'not_configured');
    assert.equal(body.plan, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
