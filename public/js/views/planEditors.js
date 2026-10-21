import { PRIORITY_VALUES } from '../../../shared/planSchema.js';
import { compareQuotes } from '../../../shared/replan.js';
import { el } from '../dom.js';
import { formatCurrency, formatDate } from '../format.js';

function money(amount, currency) {
  return formatCurrency(amount, currency);
}

function field(id, label, control) {
  return el('div', { className: 'edit-field' }, [
    el('label', { className: 'edit-label', text: label, attrs: { for: id } }),
    control,
  ]);
}

function numberInput(id, value, attrs) {
  return el('input', {
    className: 'form-control',
    attrs: { id, type: 'number', min: '0', step: 'any', inputmode: 'decimal', value: value ?? '', ...attrs },
  });
}

export function budgetEditor(model) {
  const totals = el('div', { className: 'stat-grid' }, [
    stat('Estimated total', money(model.allocated, model.currency), model.estimatesOver ? 'Over the budget' : 'Sum of estimates'),
    stat('Actual spending', money(model.actual, model.currency), model.actualOver ? 'Over the budget' : 'Sum of actual costs'),
    stat('Remaining', money(model.remaining, model.currency), model.remaining < 0 ? 'Over budget' : 'Budget minus actual spending'),
  ]);
  const gap = model.matchesTotal
    ? 'Category estimates match the budget.'
    : `Category estimates add up to ${money(model.allocated, model.currency)}, which is ${model.difference > 0 ? 'over' : 'under'} the budget by ${money(Math.abs(model.difference), model.currency)}.`;
  const items = model.items.map((item) => el('li', { className: 'edit-card', attrs: { 'data-expense-id': item.id } }, [
    el('p', { className: 'line-title', text: item.category }),
    el('div', { className: 'edit-grid' }, [
      field(`est-${item.id}`, 'Estimate', numberInput(`est-${item.id}`, item.estimated, { 'data-field': 'estimated' })),
      field(`act-${item.id}`, 'Actual', numberInput(`act-${item.id}`, item.actual ?? '', { 'data-field': 'actual', placeholder: 'Not spent' })),
    ]),
    ...(item.notes ? [el('p', { className: 'line-notes', text: item.notes })] : []),
  ]));
  return el('article', { className: 'panel screen-only', attrs: { 'aria-labelledby': 'plan-budget-heading' } }, [
    el('h2', { className: 'panel-title', text: 'Budget', attrs: { id: 'plan-budget-heading' } }),
    totals,
    el('p', { className: model.matchesTotal && !model.actualOver ? 'plan-note' : 'plan-warning', text: gap, attrs: { role: 'status' } }),
    el('ul', { className: 'edit-list' }, items),
  ]);
}

function stat(label, value, meta) {
  return el('div', { className: 'stat-card' }, [
    el('p', { className: 'stat-label', text: label }),
    el('p', { className: 'stat-value', text: value }),
    el('p', { className: 'stat-meta', text: meta }),
  ]);
}

export function timelineEditor(model) {
  const items = model.timeline.map((task) => {
    const done = el('input', { attrs: { type: 'checkbox', id: `done-${task.id}`, 'data-field': 'completed' } });
    done.checked = task.completed;
    const priority = el('select', { className: 'form-select', attrs: { id: `pri-${task.id}`, 'data-field': 'priority' } }, PRIORITY_VALUES.map((value) => el('option', { text: value[0].toUpperCase() + value.slice(1), attrs: { value, ...(value === task.priority ? { selected: '' } : {}) } })));
    return el('li', { className: `edit-card edit-card--${task.status}`, attrs: { 'data-task-id': task.id } }, [
      field(`title-${task.id}`, 'Task', el('input', { className: 'form-control', attrs: { id: `title-${task.id}`, type: 'text', maxlength: '140', value: task.title, 'data-field': 'title' } })),
      el('div', { className: 'edit-grid' }, [
        el('div', { className: 'edit-field edit-check' }, [
          done,
          el('label', { text: 'Completed', attrs: { for: `done-${task.id}` } }),
        ]),
        field(`pri-${task.id}`, 'Priority', priority),
        field(`days-${task.id}`, 'Days before event', numberInput(`days-${task.id}`, task.daysBeforeEvent, { 'data-field': 'days', min: '0', max: '1095', step: '1' })),
      ]),
      el('p', { className: 'line-meta', text: `${task.deadline ? formatDate(task.deadline) : 'Date unavailable'} · ${task.completed ? 'Completed' : task.statusLabel}` }),
    ]);
  });
  return el('article', { className: 'panel screen-only', attrs: { 'aria-labelledby': 'plan-timeline-heading' } }, [
    el('h2', { className: 'panel-title', text: 'Timeline', attrs: { id: 'plan-timeline-heading' } }),
    el('ul', { className: 'edit-list' }, items),
  ]);
}

function quoteRow(vendorId, quote, index) {
  const rowId = quote?.id || `new-${vendorId}-${index}`;
  return el('li', { className: 'quote-row', attrs: { 'data-quote-row': '', 'data-quote-id': quote?.id || '' } }, [
    field(`ql-${rowId}`, 'Quotation', el('input', { className: 'form-control', attrs: { id: `ql-${rowId}`, type: 'text', maxlength: '80', value: quote?.label || '', placeholder: 'Your label for this quote', 'data-quote-field': 'label' } })),
    field(`qa-${rowId}`, 'Amount', numberInput(`qa-${rowId}`, quote?.amount ?? '', { 'data-quote-field': 'amount' })),
    field(`qn-${rowId}`, 'Notes', el('input', { className: 'form-control', attrs: { id: `qn-${rowId}`, type: 'text', maxlength: '200', value: quote?.notes || '', 'data-quote-field': 'notes' } })),
    el('button', { className: 'btn btn-outline-danger', text: 'Remove quotation', attrs: { type: 'button', 'data-remove-quote': '' } }),
  ]);
}

export function vendorEditor(model, currency) {
  const cards = model.vendors.map((vendor) => {
    const comparison = compareQuotes(vendor.quotes);
    const lowest = comparison.lowest.length
      ? `Lowest: ${comparison.lowest.map((quote) => `${quote.label} ${money(quote.amount, currency)}`).join(', ')}`
      : 'Add quotations you have received to compare them.';
    return el('li', { className: 'edit-card', attrs: { 'data-vendor-id': vendor.id } }, [
      el('h3', { className: 'line-title', text: vendor.category }),
      el('p', { className: 'line-notes', text: vendor.tips }),
      el('p', { className: 'line-meta', text: 'Questions to ask' }),
      el('ul', {}, vendor.questions.map((question) => el('li', { text: question }))),
      el('p', { className: 'plan-note', text: lowest }),
      el('ul', { className: 'quote-list' }, (vendor.quotes ?? []).map((quote, index) => quoteRow(vendor.id, quote, index))),
      el('button', { className: 'btn btn-quiet', text: 'Add quotation', attrs: { type: 'button', 'data-add-quote': '' } }),
    ]);
  });
  return el('article', { className: 'panel screen-only', attrs: { 'aria-labelledby': 'plan-vendor-heading' } }, [
    el('h2', { className: 'panel-title', text: 'Vendor checklist', attrs: { id: 'plan-vendor-heading' } }),
    el('p', { className: 'plan-note', text: 'Categories and questions only. Enter quotations yourself. No business is recommended or confirmed.' }),
    el('ul', { className: 'edit-list' }, cards),
  ]);
}
