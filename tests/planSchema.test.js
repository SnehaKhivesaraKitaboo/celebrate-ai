import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, PLAN_RESPONSE_SCHEMA } from '../shared/planSchema.js';
import { sampleEvent, samplePlanRaw } from './samplePlan.js';

test('the response schema is a closed object Gemini can be asked to fill', () => {
  assert.equal(PLAN_RESPONSE_SCHEMA.type, 'object');
  assert.equal(PLAN_RESPONSE_SCHEMA.additionalProperties, false);
  assert.ok(PLAN_RESPONSE_SCHEMA.required.includes('assumptions'));
  assert.ok(PLAN_RESPONSE_SCHEMA.required.includes('disclaimer'));
  assert.deepEqual(PLAN_RESPONSE_SCHEMA.properties.timeline.items.properties.priority.enum, ['high', 'medium', 'low']);
});

test('a complete plan keeps ids and replaces the model currency and total', () => {
  const result = normalizePlan(samplePlanRaw(), sampleEvent);
  assert.equal(result.ok, true);
  assert.equal(result.plan.budget.currency, 'INR');
  assert.equal(result.plan.budget.total, 800000);
  assert.equal(result.plan.budget.allocated, 800000);
  assert.equal(result.plan.budget.difference, 0);
  assert.deepEqual(result.plan.budget.items.map((item) => item.id), ['exp-venue', 'exp-catering', 'exp-decor']);
  assert.equal(result.plan.timeline[0].id, 'task-venue');
  assert.equal(result.plan.timeline[0].daysBeforeEvent, 180);
});

test('allocated is the sum of line items when the model total does not match', () => {
  const raw = samplePlanRaw();
  raw.budget.items[2].estimated = 100000;
  raw.budget.total = 800000;
  const result = normalizePlan(raw, sampleEvent);
  assert.equal(result.plan.budget.allocated, 750000);
  assert.equal(result.plan.budget.difference, -50000);
  assert.equal(result.plan.budget.total, 800000);
});

test('duplicate and missing ids are replaced with unique prefixed ids', () => {
  const raw = samplePlanRaw();
  raw.budget.items[1].id = 'exp-venue';
  raw.budget.items[2].id = 'not an id';
  const ids = normalizePlan(raw, sampleEvent).plan.budget.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('exp-')));
});

test('incomplete plans are rejected', () => {
  const cases = [
    ['assumptions', (raw) => { raw.assumptions = []; }],
    ['disclaimer', (raw) => { raw.disclaimer = '   '; }],
    ['vendors', (raw) => { raw.vendorChecklist[0].questions = []; }],
    ['timeline', (raw) => { raw.timeline[0].priority = 'urgent'; }],
    ['timeline', (raw) => { raw.timeline[0].daysBeforeEvent = 1.5; }],
    ['budget', (raw) => { raw.budget.items[0].estimated = -1; }],
    ['ideas', (raw) => { raw.ideas = ['Only one']; }],
    ['summary', (raw) => { delete raw.eventSummary; }],
    ['not_object', () => null],
  ];
  for (const [reason, mutate] of cases) {
    const raw = samplePlanRaw();
    const input = mutate(raw) === null ? null : raw;
    assert.equal(normalizePlan(input, sampleEvent).reason, reason, reason);
  }
});

test('unknown fields are dropped and control characters are stripped', () => {
  const raw = samplePlanRaw();
  raw.vendorName = 'A Real Hall';
  raw.eventSummary = 'A garden\u0000 wedding.';
  const result = normalizePlan(raw, sampleEvent);
  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.plan, 'vendorName'), false);
  assert.equal(result.plan.eventSummary, 'A garden wedding.');
});
