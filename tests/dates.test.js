import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseISODate, daysBetween, addYears, toISODate } from '../shared/dates.js';

test('parseISODate accepts real calendar dates only', () => {
  assert.ok(parseISODate('2028-02-29'));
  assert.equal(parseISODate('2027-02-29'), null);
  assert.equal(parseISODate('2027-13-01'), null);
  assert.equal(parseISODate('27-01-01'), null);
  assert.equal(parseISODate('2027-01-01T00:00'), null);
  assert.equal(parseISODate(20270101), null);
});

test('daysBetween counts whole days and is negative for earlier dates', () => {
  assert.equal(daysBetween('2026-10-21', '2026-10-21'), 0);
  assert.equal(daysBetween('2026-10-21', '2026-12-25'), 65);
  assert.equal(daysBetween('2026-10-21', '2026-10-20'), -1);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('bad', '2026-10-21'), null);
});

test('addYears and toISODate produce YYYY-MM-DD strings', () => {
  assert.equal(addYears('2026-10-21', 3), '2029-10-21');
  assert.equal(toISODate(new Date(2026, 0, 5)), '2026-01-05');
});
