import { EVENT_TYPES, CURRENCIES, DIETARY_OPTIONS, EVENT_LIMITS as L } from './constants.js';
import { parseISODate, daysBetween, addYears, toISODate } from './dates.js';

const CITY_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .,'-]*$/u;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EVENT_TYPE_VALUES = EVENT_TYPES.map((t) => t.value);
const DIETARY_VALUES = DIETARY_OPTIONS.map((d) => d.value);

function cleanText(value) {
  return typeof value === 'string' ? value.replace(CONTROL_CHARS, '').trim().replace(/[ \t]+/g, ' ') : '';
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function checkEventType(value) {
  return EVENT_TYPE_VALUES.includes(value) ? { value } : { error: 'Choose an event type.' };
}

function checkDate(value, today, allowPast) {
  if (!value) return { error: 'Enter the event date.' };
  if (!parseISODate(value)) return { error: 'Enter a valid date.' };
  if (!allowPast && daysBetween(today, value) < 0) return { error: 'The event date cannot be in the past.' };
  if (daysBetween(addYears(today, L.maxYearsAhead), value) > 0) {
    return { error: `Choose a date within the next ${L.maxYearsAhead} years.` };
  }
  return { value };
}

function checkCity(value) {
  const city = cleanText(value);
  if (!city) return { error: 'Enter the city.' };
  if (city.length < L.cityMin || city.length > L.cityMax) {
    return { error: `City must be ${L.cityMin}–${L.cityMax} characters.` };
  }
  return CITY_PATTERN.test(city) ? { value: city } : { error: 'City can contain letters, spaces, and . , \' - only.' };
}

function checkGuestCount(value) {
  const guests = toNumber(value);
  if (Number.isNaN(guests)) return { error: 'Enter the number of guests.' };
  if (!Number.isInteger(guests) || guests < L.guestMin || guests > L.guestMax) {
    return { error: `Guest count must be a whole number from ${L.guestMin} to ${L.guestMax}.` };
  }
  return { value: guests };
}

function checkBudget(value) {
  const budget = toNumber(value);
  if (Number.isNaN(budget)) return { error: 'Enter the total budget.' };
  if (!Number.isFinite(budget) || budget < L.budgetMin || budget > L.budgetMax) {
    return { error: `Budget must be between ${L.budgetMin} and ${L.budgetMax.toLocaleString('en')}.` };
  }
  return { value: Math.round(budget * 100) / 100 };
}

function checkCurrency(value) {
  return CURRENCIES.includes(value) ? { value } : { error: 'Choose a supported currency.' };
}

function checkOptionalText(value, max, label) {
  const text = cleanText(value);
  return text.length > max ? { error: `${label} must be ${max} characters or fewer.` } : { value: text };
}

function checkDietary(value) {
  const list = value === undefined ? [] : value;
  if (!Array.isArray(list) || !list.every((item) => DIETARY_VALUES.includes(item))) {
    return { error: 'Choose dietary preferences from the list.' };
  }
  return { value: [...new Set(list)] };
}

/**
 * Validates raw event details from the form or an API request.
 * @param {object} input raw field values
 * @param {{ today?: string, allowPast?: boolean }} [options]
 *   today: YYYY-MM-DD (defaults to the local date); allowPast: accept past dates when restoring a saved event
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object | null }}
 */
export function validateEvent(input, { today = toISODate(new Date()), allowPast = false } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const checks = {
    eventType: checkEventType(source.eventType),
    eventDate: checkDate(source.eventDate, today, allowPast),
    city: checkCity(source.city),
    guestCount: checkGuestCount(source.guestCount),
    budget: checkBudget(source.budget),
    currency: checkCurrency(source.currency),
    theme: checkOptionalText(source.theme, L.themeMax, 'Theme'),
    dietaryPreferences: checkDietary(source.dietaryPreferences),
    specialRequirements: checkOptionalText(source.specialRequirements, L.specialRequirementsMax, 'Special requirements'),
  };

  const errors = {};
  const value = {};
  for (const [field, result] of Object.entries(checks)) {
    if (result.error) errors[field] = result.error;
    else value[field] = result.value;
  }
  const valid = Object.keys(errors).length === 0;
  return { valid, errors, value: valid ? value : null };
}
