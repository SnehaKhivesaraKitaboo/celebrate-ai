import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan } from '../shared/planSchema.js';
import { buildPlanModel } from '../public/js/views/planModel.js';
import { sampleEvent, samplePlanRaw } from './samplePlan.js';

test('the plan view recalculates totals and marks past deadlines', () => {
  const raw = samplePlanRaw();
  raw.budget.items[0].estimated = 400000;
  raw.budget.allocated = 1;
  raw.timeline.find((task) => task.id === 'task-runthrough').daysBeforeEvent = 0;
  const plan = normalizePlan(raw, sampleEvent).plan;
  const model = buildPlanModel(
    { ...sampleEvent, eventDate: '2026-10-21' },
    plan,
    '2026-10-21',
  );
  assert.equal(model.budgetTotal, 800000);
  assert.equal(model.allocated, 900000);
  assert.equal(model.matchesTotal, false);
  const venue = model.timeline.find((task) => task.id === 'task-venue');
  assert.equal(venue.deadline, '2026-04-24');
  assert.equal(venue.status, 'overdue');
  assert.equal(venue.statusLabel, 'Overdue');
  const runThrough = model.timeline.find((task) => task.id === 'task-runthrough');
  assert.equal(runThrough.deadline, '2026-10-21');
  assert.equal(runThrough.status, 'today');
});
