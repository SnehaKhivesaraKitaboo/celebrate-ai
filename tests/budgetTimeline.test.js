import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBudget } from '../shared/budget.js';
import { deadlineFor, deadlineStatus } from '../shared/timeline.js';

test('summarizeBudget rounds the sum of estimates and ignores any supplied total', () => {
  const summary = summarizeBudget(
    [{ estimated: 10.005 }, { estimated: 20.005 }, { estimated: 0.1 }],
    100,
  );
  assert.equal(summary.allocated, 30.11);
  assert.equal(summary.difference, -69.89);
  assert.equal(summary.matchesTotal, false);
});

test('remaining budget subtracts actual spending and flags over-budget actuals', () => {
  const summary = summarizeBudget(
    [{ estimated: 15000, actual: 12000 }, { estimated: 10000, actual: null }, { estimated: 5000, actual: 4000 }],
    25000,
  );
  assert.equal(summary.allocated, 30000);
  assert.equal(summary.actual, 16000);
  assert.equal(summary.remaining, 9000);
  assert.equal(summary.estimatesOver, true);
  assert.equal(summary.actualOver, false);
  const over = summarizeBudget([{ estimated: 1000, actual: 26000 }], 25000);
  assert.equal(over.remaining, -1000);
  assert.equal(over.actualOver, true);
});

test('a matching allocation is not flagged', () => {
  const summary = summarizeBudget([{ estimated: 40 }, { estimated: 60 }], 100);
  assert.equal(summary.matchesTotal, true);
  assert.equal(summary.difference, 0);
});

test('deadlines are counted back from the event date', () => {
  assert.equal(deadlineFor('2027-02-14', 180), '2026-08-18');
  assert.equal(deadlineFor('2027-02-14', 0), '2027-02-14');
  assert.equal(deadlineFor('2027-02-14', -1), null);
  assert.equal(deadlineFor('bad', 1), null);
});

test('deadline status distinguishes overdue, today, and upcoming', () => {
  assert.equal(deadlineStatus('2026-10-21', '2026-10-19'), 'overdue');
  assert.equal(deadlineStatus('2026-10-21', '2026-10-21'), 'today');
  assert.equal(deadlineStatus('2026-10-21', '2026-10-22'), 'upcoming');
  assert.equal(deadlineStatus('2026-10-21', 'nope'), 'unknown');
});
