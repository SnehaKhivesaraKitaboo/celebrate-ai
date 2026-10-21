import { EVENT_TYPES, CURRENCIES, DIETARY_OPTIONS, EVENT_LIMITS } from '../../../shared/constants.js';
import { toISODate, addYears } from '../../../shared/dates.js';
import { el } from '../dom.js';

/** Maps validation field names to their control and error-message elements. */
export const FIELDS = Object.freeze({
  eventType: { controlId: 'event-type', errorId: 'event-type-error' },
  eventDate: { controlId: 'event-date', errorId: 'event-date-error' },
  city: { controlId: 'city', errorId: 'city-error' },
  guestCount: { controlId: 'guest-count', errorId: 'guest-count-error' },
  budget: { controlId: 'budget', errorId: 'budget-error' },
  currency: { controlId: 'currency', errorId: 'currency-error' },
  theme: { controlId: 'theme', errorId: 'theme-error' },
  dietaryPreferences: { controlId: `diet-${DIETARY_OPTIONS[0].value}`, errorId: 'dietary-error' },
  specialRequirements: { controlId: 'special-requirements', errorId: 'special-error' },
});

function addOptions(select, options) {
  options.forEach(({ value, label }) => select.append(el('option', { text: label, attrs: { value } })));
}

function dietaryCheckbox({ value, label }) {
  const id = `diet-${value}`;
  return el('div', { className: 'form-check' }, [
    el('input', { className: 'form-check-input', attrs: { type: 'checkbox', id, name: 'dietaryPreferences', value } }),
    el('label', { className: 'form-check-label', text: label, attrs: { for: id } }),
  ]);
}

export function populateOptions(form) {
  addOptions(form.elements.eventType, EVENT_TYPES);
  addOptions(form.elements.currency, CURRENCIES.map((code) => ({ value: code, label: code })));
  form.querySelector('[data-dietary-options]').append(...DIETARY_OPTIONS.map(dietaryCheckbox));

  const today = toISODate(new Date());
  form.elements.eventDate.min = today;
  form.elements.eventDate.max = addYears(today, EVENT_LIMITS.maxYearsAhead);
  form.elements.budget.max = String(EVENT_LIMITS.budgetMax);
}

export function readForm(form) {
  const data = new FormData(form);
  return {
    eventType: data.get('eventType'),
    eventDate: data.get('eventDate'),
    city: data.get('city'),
    guestCount: data.get('guestCount'),
    budget: data.get('budget'),
    currency: data.get('currency'),
    theme: data.get('theme'),
    dietaryPreferences: data.getAll('dietaryPreferences'),
    specialRequirements: data.get('specialRequirements'),
  };
}

export function fillForm(form, event) {
  const { elements } = form;
  elements.eventType.value = event?.eventType ?? '';
  elements.eventDate.value = event?.eventDate ?? '';
  elements.city.value = event?.city ?? '';
  elements.guestCount.value = event?.guestCount ?? '';
  elements.budget.value = event?.budget ?? '';
  elements.currency.value = event?.currency ?? CURRENCIES[0];
  elements.theme.value = event?.theme ?? '';
  elements.specialRequirements.value = event?.specialRequirements ?? '';
  const selected = new Set(event?.dietaryPreferences ?? []);
  form.querySelectorAll('[name="dietaryPreferences"]').forEach((box) => {
    box.checked = selected.has(box.value);
  });
}
