import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, STORAGE_KEY } from '../public/js/storage.js';
import { createStore } from '../public/js/store.js';
import { normalizePlan } from '../shared/planSchema.js';
import { samplePlanRaw } from './samplePlan.js';

function memoryBackend(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    raw: data,
  };
}

const failingBackend = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('quota'); },
  removeItem() { throw new Error('denied'); },
};

const event = {
  eventType: 'birthday',
  eventDate: '2027-05-01',
  city: 'Mumbai',
  guestCount: 40,
  budget: 60000,
  currency: 'INR',
  theme: '',
  dietaryPreferences: [],
  specialRequirements: '',
};

test('saved event is restored by a new store instance', () => {
  const backend = memoryBackend();
  const fixedNow = () => new Date('2026-10-21T10:00:00Z');
  createStore(createStorage(backend), { now: fixedNow }).saveEvent(event);

  const restored = createStore(createStorage(backend)).getState();
  assert.deepEqual(restored.event, event);
  assert.equal(restored.savedAt, '2026-10-21T10:00:00.000Z');
});

test('clearEvent removes persisted data and notifies subscribers', () => {
  const backend = memoryBackend();
  const store = createStore(createStorage(backend));
  store.saveEvent(event);
  const seen = [];
  store.subscribe((state) => seen.push(state.event));

  assert.equal(store.clearEvent(), true);
  assert.equal(backend.raw.has(STORAGE_KEY), false);
  assert.deepEqual(seen, [null]);
});

test('corrupt, outdated, or tampered data falls back to an empty state', () => {
  const cases = ['{not json', JSON.stringify({ version: 0, event }), JSON.stringify({ version: 1, event: { ...event, currency: 'XYZ' } })];
  for (const raw of cases) {
    const store = createStore(createStorage(memoryBackend({ [STORAGE_KEY]: raw })));
    assert.equal(store.getState().event, null, raw);
  }
});

test('a saved event whose date has passed is still restored', () => {
  const backend = memoryBackend({ [STORAGE_KEY]: JSON.stringify({ version: 1, event: { ...event, eventDate: '2020-01-01' } }) });
  assert.equal(createStore(createStorage(backend)).getState().event.eventDate, '2020-01-01');
});

test('a valid plan is restored and an invalid plan is dropped', () => {
  const plan = normalizePlan(samplePlanRaw(), { ...event, budget: 800000, currency: 'INR' }).plan;
  const backend = memoryBackend();
  createStore(createStorage(backend)).saveEvent({ ...event, budget: 800000, currency: 'INR' }, plan);
  const restored = createStore(createStorage(backend)).getState();
  assert.equal(restored.plan.budget.currency, 'INR');
  assert.equal(restored.plan.budget.items[0].id, 'exp-venue');

  const tampered = JSON.parse(backend.raw.get(STORAGE_KEY));
  tampered.plan.eventSummary = '';
  backend.raw.set(STORAGE_KEY, JSON.stringify(tampered));
  assert.equal(createStore(createStorage(backend)).getState().plan, null);
  assert.equal(createStore(createStorage(backend)).getState().event.city, 'Mumbai');
});

test('unavailable storage does not throw and reports failure', () => {
  const store = createStore(createStorage(failingBackend));
  assert.equal(store.getState().event, null);
  assert.equal(store.saveEvent(event), false);
  assert.deepEqual(store.getState().event, event);
  assert.equal(store.clearEvent(), false);
});
