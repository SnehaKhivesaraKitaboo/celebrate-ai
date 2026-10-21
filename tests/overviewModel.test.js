import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview, describeCountdown } from '../public/js/views/overviewModel.js';

const fmt = {
  number: (n) => String(n),
  currency: (amount, currency) => `${currency} ${amount.toFixed(2)}`,
  date: (iso) => iso,
};

test('describeCountdown handles future, today, tomorrow, and past dates', () => {
  assert.equal(describeCountdown('2026-10-21', '2026-12-25').value, '65 days');
  assert.equal(describeCountdown('2026-10-21', '2026-10-22').value, '1 day');
  assert.equal(describeCountdown('2026-10-21', '2026-10-21').value, 'Today');
  const past = describeCountdown('2026-10-21', '2026-10-19');
  assert.equal(past.value, 'Event date passed');
  assert.equal(past.meta, '2 days ago');
});

test('buildOverview computes budget per guest locally', () => {
  const model = buildOverview(
    { eventType: 'anniversary', eventDate: '2026-12-01', city: 'Goa', guestCount: 3, budget: 1000, currency: 'USD',
      theme: '', dietaryPreferences: ['vegan'], specialRequirements: '' },
    '2026-10-21',
    fmt,
  );
  const perGuest = model.stats.find((s) => s.label === 'Budget per guest');
  assert.equal(perGuest.value, 'USD 333.33');
  assert.equal(model.details.find((d) => d.term === 'Event type').value, 'Anniversary');
  assert.deepEqual(model.details.find((d) => d.term === 'Dietary preferences').tags, ['Vegan']);
  assert.equal(model.details.find((d) => d.term === 'Theme').value, 'Not specified');
});
