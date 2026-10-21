import { toISODate } from '../../../shared/dates.js';
import { acceptReplan } from '../../../shared/replan.js';
import { el, announce } from '../dom.js';
import { formatCurrency, formatDate } from '../format.js';
import { requestReplan } from '../api.js';
import { buildPlanModel } from './planModel.js';
import { budgetEditor, timelineEditor, vendorEditor } from './planEditors.js';
import { buildPrintSections, formatChangeValue } from './planPrint.js';

const ESTIMATE_NOTE = 'These figures are planning estimates, not verified market prices, quotes, or confirmed bookings.';
const fmt = { currency: formatCurrency, date: formatDate };

function textList(title, id, values) {
  return el('article', { className: 'panel', attrs: { 'aria-labelledby': id } }, [
    el('h2', { className: 'panel-title', text: title, attrs: { id } }),
    el('ul', { className: 'plain-list' }, values.map((value) => el('li', { text: value }))),
  ]);
}

function conflictText(conflict, currency) {
  if (conflict.type === 'estimates_over') return `Estimates exceed the budget by ${formatCurrency(conflict.amount, currency)}.`;
  if (conflict.type === 'actual_over') return `Actual spending exceeds the budget by ${formatCurrency(conflict.amount, currency)}.`;
  if (conflict.type === 'overdue' && conflict.title) return `${conflict.title} is past its deadline.`;
  return '';
}

function replanBlock(replan, currency) {
  if (!replan) return el('div');
  const changes = (replan.changes ?? []).map((change) => el('li', {}, [
    el('p', { className: 'line-title', text: String(change.area ?? 'Change') }),
    el('p', { className: 'line-notes', text: `${formatChangeValue(change.area, change.before, currency, 'before', fmt)} → ${formatChangeValue(change.area, change.after, currency, 'after', fmt)}` }),
  ]));
  const notes = (replan.notes ?? []).map((note) => el('li', { text: `${note.area}: ${note.reason}` }));
  const conflicts = [...(replan.conflicts ?? []).map((conflict) => conflictText(conflict, currency)), ...(replan.infeasible ?? [])].filter(Boolean);
  return el('article', { className: 'panel', attrs: { 'aria-labelledby': 'replan-result-heading' } }, [
    el('h2', { className: 'panel-title', text: 'What changed', attrs: { id: 'replan-result-heading', tabindex: '-1' } }),
    changes.length ? el('ul', { className: 'edit-list' }, changes) : el('p', { text: 'The revision kept the same figures.' }),
    ...(notes.length ? [el('h3', { className: 'line-title', text: "Planner's notes" }), el('ul', { className: 'plain-list' }, notes)] : []),
    ...(conflicts.length ? [el('ul', { className: 'conflict-list', attrs: { role: 'status' } }, conflicts.map((text) => el('li', { text })))] : []),
  ]);
}

function printBlock(event, model, replan) {
  const sections = buildPrintSections(event, model, replan, fmt).map((section) => el('section', {}, [
    el('h2', { text: section.heading }),
    ...section.lines.map((line) => el('p', { text: line })),
  ]));
  return el('div', { className: 'print-only' }, sections);
}

function render(root, state) {
  const hasPlan = Boolean(state.event && state.plan);
  root.querySelector('[data-plan-empty]').hidden = hasPlan;
  root.querySelector('[data-plan-content]').hidden = !hasPlan;
  root.querySelector('[data-print-plan]').hidden = !hasPlan;
  if (!hasPlan) return;

  const model = buildPlanModel(state.event, state.plan, toISODate(new Date()));
  root.querySelector('[data-plan-summary]').textContent = model.summary;
  root.querySelector('[data-plan-theme-name]').textContent = model.theme.name;
  root.querySelector('[data-plan-theme-description]').textContent = model.theme.description;
  root.querySelector('[data-plan-palette]').replaceChildren(...model.theme.palette.map((color) => el('li', { className: 'tag', text: color })));
  root.querySelector('[data-plan-disclaimer]').textContent = model.disclaimer;
  root.querySelector('[data-plan-budget]').replaceChildren(budgetEditor(model));
  root.querySelector('[data-plan-timeline]').replaceChildren(timelineEditor(model));
  root.querySelector('[data-plan-vendors]').replaceChildren(vendorEditor(model, model.currency));
  root.querySelector('[data-plan-ideas]').replaceChildren(textList('Ideas', 'plan-ideas-heading', model.ideas));
  root.querySelector('[data-plan-assumptions]').replaceChildren(textList('Assumptions', 'plan-assumptions-heading', model.assumptions));
  root.querySelector('[data-replan-result]').replaceChildren(replanBlock(state.replan, model.currency));
  root.querySelector('[data-print-summary]').replaceChildren(printBlock(state.event, model, state.replan));
}

function readNumber(input) {
  const text = input.value.trim();
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : Number.NaN;
}

function onChange(event, store) {
  const expense = event.target.closest('[data-expense-id]');
  if (expense && event.target.dataset.field) {
    const estimated = readNumber(expense.querySelector('[data-field="estimated"]'));
    const actual = readNumber(expense.querySelector('[data-field="actual"]'));
    const ok = estimated != null && !Number.isNaN(estimated) && !Number.isNaN(actual)
      && store.updateExpense(expense.dataset.expenseId, { estimated, actual });
    if (!ok) {
      restoreExpense(expense, store);
      announce('Enter a valid estimate. Leave actual blank until you have spent money.');
    }
    return;
  }
  const task = event.target.closest('[data-task-id]');
  if (task && event.target.dataset.field) {
    const days = readNumber(task.querySelector('[data-field="days"]'));
    const ok = days != null && store.updateTask(task.dataset.taskId, {
      title: task.querySelector('[data-field="title"]').value,
      priority: task.querySelector('[data-field="priority"]').value,
      daysBeforeEvent: days,
      completed: task.querySelector('[data-field="completed"]').checked,
    });
    if (!ok) {
      restoreTask(task, store);
      announce('Check the task title, priority, and days before the event.');
    }
    return;
  }
  const vendor = event.target.closest('[data-vendor-id]');
  if (vendor && event.target.dataset.quoteField && !hasPartialQuote(vendor)) saveQuotes(vendor, store);
}

function restoreExpense(expense, store) {
  const item = store.getState().plan?.budget.items.find((entry) => entry.id === expense.dataset.expenseId);
  if (!item) return;
  expense.querySelector('[data-field="estimated"]').value = item.estimated;
  expense.querySelector('[data-field="actual"]').value = item.actual ?? '';
}

function restoreTask(task, store) {
  const saved = store.getState().plan?.timeline.find((entry) => entry.id === task.dataset.taskId);
  if (!saved) return;
  task.querySelector('[data-field="title"]').value = saved.title;
  task.querySelector('[data-field="priority"]').value = saved.priority;
  task.querySelector('[data-field="days"]').value = saved.daysBeforeEvent;
  task.querySelector('[data-field="completed"]').checked = saved.completed;
}

function hasPartialQuote(vendor) {
  return [...vendor.querySelectorAll('[data-quote-row]')].some((row) => {
    const label = row.querySelector('[data-quote-field="label"]').value.trim();
    const amount = row.querySelector('[data-quote-field="amount"]').value.trim();
    return Boolean(label) !== Boolean(amount);
  });
}

function collectQuotes(vendor) {
  return [...vendor.querySelectorAll('[data-quote-row]')].flatMap((row) => {
    const label = row.querySelector('[data-quote-field="label"]').value;
    const amount = readNumber(row.querySelector('[data-quote-field="amount"]'));
    const notes = row.querySelector('[data-quote-field="notes"]').value;
    if (!label.trim() || amount == null || Number.isNaN(amount)) return [];
    return [{ id: row.dataset.quoteId || undefined, label, amount, notes }];
  });
}

function saveQuotes(vendor, store) {
  const ok = store.setQuotes(vendor.dataset.vendorId, collectQuotes(vendor));
  if (!ok) announce('Enter a label and an amount for each quotation.');
}

function onClick(event, store) {
  const vendor = event.target.closest('[data-vendor-id]');
  if (!vendor) return;
  if (event.target.closest('[data-add-quote]')) {
    vendor.querySelector('.quote-list').append(quoteDraft(vendor.dataset.vendorId));
    const labels = vendor.querySelectorAll('[data-quote-field="label"]');
    labels[labels.length - 1]?.focus();
    return;
  }
  if (event.target.closest('[data-remove-quote]')) {
    event.target.closest('[data-quote-row]')?.remove();
    saveQuotes(vendor, store);
  }
}

function quoteDraft(vendorId) {
  const row = document.createElement('li');
  row.className = 'quote-row';
  row.dataset.quoteRow = '';
  row.dataset.quoteId = '';
  const label = document.createElement('input');
  label.className = 'form-control';
  label.id = `draft-label-${vendorId}-${Date.now()}`;
  label.type = 'text';
  label.maxLength = 80;
  label.placeholder = 'Your label for this quote';
  label.dataset.quoteField = 'label';
  const amount = document.createElement('input');
  amount.className = 'form-control';
  amount.id = `draft-amount-${vendorId}-${Date.now()}`;
  amount.type = 'number';
  amount.min = '0';
  amount.step = 'any';
  amount.dataset.quoteField = 'amount';
  const notes = document.createElement('input');
  notes.className = 'form-control';
  notes.id = `draft-notes-${vendorId}-${Date.now()}`;
  notes.type = 'text';
  notes.maxLength = 200;
  notes.dataset.quoteField = 'notes';
  const labelWrap = document.createElement('div');
  labelWrap.className = 'edit-field';
  const labelName = document.createElement('label');
  labelName.className = 'edit-label';
  labelName.htmlFor = label.id;
  labelName.textContent = 'Quotation';
  labelWrap.append(labelName, label);
  const amountWrap = document.createElement('div');
  amountWrap.className = 'edit-field';
  const amountName = document.createElement('label');
  amountName.className = 'edit-label';
  amountName.htmlFor = amount.id;
  amountName.textContent = 'Amount';
  amountWrap.append(amountName, amount);
  const notesWrap = document.createElement('div');
  notesWrap.className = 'edit-field';
  const notesName = document.createElement('label');
  notesName.className = 'edit-label';
  notesName.htmlFor = notes.id;
  notesName.textContent = 'Notes';
  notesWrap.append(notesName, notes);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-outline-danger';
  remove.dataset.removeQuote = '';
  remove.textContent = 'Remove quotation';
  row.append(labelWrap, amountWrap, notesWrap, remove);
  return row;
}

function setReplanBusy(form, busy) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = busy;
  button.textContent = busy ? 'Updating plan…' : 'Update plan';
  form.setAttribute('aria-busy', String(busy));
}

export function initPlan(root, store) {
  root.querySelector('[data-plan-estimate-note]').textContent = ESTIMATE_NOTE;
  root.addEventListener('change', (event) => onChange(event, store));
  root.addEventListener('click', (event) => onClick(event, store));
  root.querySelector('[data-print-plan]').addEventListener('click', () => window.print());

  const form = root.querySelector('[data-replan-form]');
  const error = root.querySelector('[data-replan-error]');
  let busy = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const { event: currentEvent, plan } = store.getState();
    const change = form.elements.change.value;
    if (!currentEvent || !plan) {
      error.hidden = false;
      error.textContent = 'Generate a plan before requesting a change.';
      return;
    }
    if (!change.trim()) {
      error.hidden = false;
      error.textContent = 'Describe the change you want.';
      form.elements.change.focus();
      return;
    }
    busy = true;
    setReplanBusy(form, true);
    error.hidden = true;
    error.textContent = '';
    try {
      const response = await requestReplan(currentEvent, plan, change.trim());
      const accepted = acceptReplan(currentEvent, plan, response, change.trim(), toISODate(new Date()));
      if (!accepted.ok) {
        error.hidden = false;
        error.textContent = 'The planner returned an unusable response. Your current plan was kept.';
        return;
      }
      store.saveReplan(accepted);
      form.elements.change.value = '';
      announce('Plan updated.');
      root.querySelector('#replan-result-heading')?.focus();
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message || 'The planning request failed. Your current plan was kept.';
      error.focus();
    } finally {
      busy = false;
      setReplanBusy(form, false);
    }
  });

  store.subscribe((state) => render(root, state));
  render(root, store.getState());
}
