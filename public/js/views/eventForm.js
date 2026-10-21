import { validateEvent } from '../../../shared/eventValidation.js';
import { normalizePlan } from '../../../shared/planSchema.js';
import { EVENT_LIMITS } from '../../../shared/constants.js';
import { el, announce } from '../dom.js';
import { requestPlan } from '../api.js';
import { FIELDS, populateOptions, readForm, fillForm } from './eventFormFields.js';

function setFieldError(form, field, message) {
  const { controlId, errorId } = FIELDS[field];
  const control = form.querySelector(`#${controlId}`);
  const errorNode = form.querySelector(`#${errorId}`);
  const targets = field === 'dietaryPreferences' ? form.querySelectorAll('[name="dietaryPreferences"]') : [control];
  targets.forEach((node) => {
    node.classList.toggle('is-invalid', Boolean(message));
    if (message) node.setAttribute('aria-invalid', 'true');
    else node.removeAttribute('aria-invalid');
  });
  errorNode.textContent = message ?? '';
}

function errorLink(form, field, message) {
  const { controlId } = FIELDS[field];
  const link = el('a', { text: message, attrs: { href: `#${controlId}` } });
  link.addEventListener('click', (event) => {
    event.preventDefault();
    form.querySelector(`#${controlId}`)?.focus();
  });
  return el('li', {}, [link]);
}

function showErrors(form, errors) {
  Object.keys(FIELDS).forEach((field) => setFieldError(form, field, errors[field]));
  const summary = form.querySelector('[data-error-summary]');
  const list = summary.querySelector('[data-error-list]');
  const entries = Object.entries(errors);
  list.replaceChildren(...entries.map(([field, message]) => errorLink(form, field, message)));
  summary.hidden = entries.length === 0;
}

function revalidateField(form, field) {
  const { errors } = validateEvent(readForm(form));
  setFieldError(form, field, errors[field]);
}

function updateCharCount(form) {
  const length = form.elements.specialRequirements.value.length;
  form.querySelector('[data-char-count]').textContent = `${length} / ${EVENT_LIMITS.specialRequirementsMax}`;
}

function showRequestError(form, message) {
  const node = form.querySelector('[data-request-error]');
  node.hidden = !message;
  node.textContent = message;
}

function setBusy(form, busy) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = busy;
  button.textContent = busy ? 'Generating plan…' : 'Generate event plan';
  form.setAttribute('aria-busy', String(busy));
}

export function initEventForm(form, store) {
  populateOptions(form);
  fillForm(form, store.getState().event);
  updateCharCount(form);
  let busy = false;

  form.addEventListener('input', (event) => {
    if (event.target.name === 'specialRequirements') updateCharCount(form);
    const field = event.target.name;
    if (Object.hasOwn(FIELDS, field) && form.querySelector(`#${FIELDS[field].errorId}`).textContent) {
      revalidateField(form, field);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const result = validateEvent(readForm(form));
    showErrors(form, result.errors);
    showRequestError(form, '');
    if (!result.valid) {
      form.querySelector('[data-error-summary]').focus();
      return;
    }
    busy = true;
    setBusy(form, true);
    try {
      const received = await requestPlan(result.value);
      const checked = normalizePlan(received, result.value);
      if (!checked.ok) {
        showRequestError(form, 'The planner returned an unusable response. Please try again.');
        return;
      }
      const persisted = store.saveEvent(result.value, checked.plan);
      announce(persisted ? 'Event plan generated.' : 'Event plan generated, but this browser could not save it.');
      window.location.hash = '#plan';
    } catch (err) {
      showRequestError(form, err.message || 'The planning request failed. Please try again.');
      if (err.fields) {
        showErrors(form, err.fields);
        form.querySelector('[data-error-summary]').focus();
      } else {
        form.querySelector('[data-request-error]').focus();
      }
    } finally {
      busy = false;
      setBusy(form, false);
    }
  });

  store.subscribe((state) => {
    if (!state.event) {
      fillForm(form, null);
      showErrors(form, {});
      updateCharCount(form);
    }
  });
}
