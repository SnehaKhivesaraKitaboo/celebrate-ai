import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvent } from '../shared/eventValidation.js';

const TODAY = '2026-10-21';
const validInput = () => ({
  eventType: 'wedding',
  eventDate: '2027-02-14',
  city: 'Pune',
  guestCount: '150',
  budget: '800000',
  currency: 'INR',
  theme: '  Rustic   garden ',
  dietaryPreferences: ['vegetarian', 'jain', 'vegetarian'],
  specialRequirements: 'Wheelchair access',
});

const validate = (input, options = {}) => validateEvent(input, { today: TODAY, ...options });

test('accepts a complete event and normalizes values', () => {
  const result = validate(validInput());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.guestCount, 150);
  assert.equal(result.value.budget, 800000);
  assert.equal(result.value.theme, 'Rustic garden');
  assert.deepEqual(result.value.dietaryPreferences, ['vegetarian', 'jain']);
});

test('optional fields may be omitted', () => {
  const { theme, dietaryPreferences, specialRequirements, ...required } = validInput();
  const result = validate(required);
  assert.equal(result.valid, true);
  assert.equal(result.value.theme, '');
  assert.deepEqual(result.value.dietaryPreferences, []);
});

test('reports every missing required field', () => {
  const result = validate({});
  assert.equal(result.valid, false);
  assert.equal(result.value, null);
  assert.deepEqual(Object.keys(result.errors).sort(), ['budget', 'city', 'currency', 'eventDate', 'eventType', 'guestCount']);
});

test('handles non-object input without throwing', () => {
  assert.equal(validate(null).valid, false);
  assert.equal(validate('wedding').valid, false);
});

test('rejects past dates but allows today', () => {
  assert.match(validate({ ...validInput(), eventDate: '2026-10-20' }).errors.eventDate, /past/);
  assert.equal(validate({ ...validInput(), eventDate: TODAY }).valid, true);
});

test('allowPast accepts past dates for restoring saved events', () => {
  assert.equal(validate({ ...validInput(), eventDate: '2026-01-01' }, { allowPast: true }).valid, true);
});

test('rejects malformed, impossible, and too-distant dates', () => {
  assert.match(validate({ ...validInput(), eventDate: '14/02/2027' }).errors.eventDate, /valid date/);
  assert.match(validate({ ...validInput(), eventDate: '2027-02-30' }).errors.eventDate, /valid date/);
  assert.match(validate({ ...validInput(), eventDate: '2029-10-22' }).errors.eventDate, /within the next 3 years/);
  assert.equal(validate({ ...validInput(), eventDate: '2029-10-21' }).valid, true);
});

test('rejects invalid guest counts', () => {
  for (const guestCount of ['0', '-5', '12.5', '5001', 'many']) {
    assert.ok(validate({ ...validInput(), guestCount }).errors.guestCount, `guestCount=${guestCount}`);
  }
});

test('rejects invalid budgets', () => {
  for (const budget of ['0', '-100', 'abc', '1e12', Infinity]) {
    assert.ok(validate({ ...validInput(), budget }).errors.budget, `budget=${budget}`);
  }
});

test('rejects unsupported enum values', () => {
  const result = validate({ ...validInput(), eventType: 'funeral', currency: 'BTC', dietaryPreferences: ['paleo'] });
  assert.ok(result.errors.eventType);
  assert.ok(result.errors.currency);
  assert.ok(result.errors.dietaryPreferences);
});

test('validates city characters and length', () => {
  assert.equal(validate({ ...validInput(), city: 'São Paulo' }).valid, true);
  assert.equal(validate({ ...validInput(), city: "St. John's" }).valid, true);
  assert.ok(validate({ ...validInput(), city: '<script>' }).errors.city);
  assert.ok(validate({ ...validInput(), city: 'X' }).errors.city);
});

test('enforces optional text length limits and strips control characters', () => {
  assert.ok(validate({ ...validInput(), theme: 'a'.repeat(81) }).errors.theme);
  assert.ok(validate({ ...validInput(), specialRequirements: 'a'.repeat(501) }).errors.specialRequirements);
  assert.equal(validate({ ...validInput(), theme: 'Boho\u0000chic' }).value.theme, 'Bohochic');
});
