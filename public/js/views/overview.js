import { toISODate } from '../../../shared/dates.js';
import { EVENT_TYPES } from '../../../shared/constants.js';
import { el, announce } from '../dom.js';
import { formatCurrency, formatNumber, formatDate, formatDateTime } from '../format.js';
import { buildOverview } from './overviewModel.js';

const formatters = { currency: formatCurrency, number: formatNumber, date: formatDate };

function statCard({ label, value, meta, accent }) {
  return el('div', { className: accent ? 'stat-card stat-card--accent' : 'stat-card' }, [
    el('p', { className: 'stat-label', text: label }),
    el('p', { className: 'stat-value', text: value }),
    el('p', { className: 'stat-meta', text: meta }),
  ]);
}

function detailRow({ term, value, tags }) {
  const content = tags?.length
    ? el('ul', { className: 'tag-list' }, tags.map((tag) => el('li', { className: 'tag', text: tag })))
    : value;
  return [el('dt', { text: term }), el('dd', {}, [content])];
}

function planPreview(plan) {
  const summary = typeof plan.eventSummary === 'string' ? plan.eventSummary.trim() : '';
  const taskCount = Array.isArray(plan.timeline) ? plan.timeline.length : 0;
  const itemCount = Array.isArray(plan.budget?.items) ? plan.budget.items.length : 0;
  const meta = [];
  if (itemCount) meta.push(`${itemCount} budget ${itemCount === 1 ? 'category' : 'categories'}`);
  if (taskCount) meta.push(`${taskCount} timeline ${taskCount === 1 ? 'task' : 'tasks'}`);
  return el('div', { className: 'plan-preview-card' }, [
    el('p', { className: 'plan-preview-label', text: 'Saved plan' }),
    ...(summary ? [el('p', { className: 'plan-preview-summary', text: summary })] : []),
    ...(meta.length ? [el('p', { className: 'plan-preview-meta', text: meta.join(' · ') })] : []),
    el('a', { className: 'btn btn-primary', text: 'View the generated plan', attrs: { href: '#plan' } }),
  ]);
}

function render(root, state) {
  const { event, savedAt } = state;
  root.querySelector('[data-overview-empty]').hidden = Boolean(event);
  root.querySelector('[data-overview-content]').hidden = !event;
  const heading = root.querySelector('#overview-heading');
  if (heading) {
    const typeLabel = event
      ? EVENT_TYPES.find((t) => t.value === event.eventType)?.label
      : null;
    heading.textContent = typeLabel
      ? `Your ${typeLabel.toLowerCase()} at a glance`
      : 'Your celebration at a glance';
  }
  if (!event) return;

  const model = buildOverview(event, toISODate(new Date()), formatters);
  root.querySelector('[data-overview-stats]').replaceChildren(...model.stats.map(statCard));
  root.querySelector('[data-overview-details]').replaceChildren(...model.details.flatMap(detailRow));
  root.querySelector('[data-overview-saved]').textContent = savedAt
    ? `Last saved ${formatDateTime(savedAt)} in this browser.`
    : '';
  const planNote = root.querySelector('[data-overview-plan]');
  planNote.replaceChildren(state.plan
    ? planPreview(state.plan)
    : el('p', { className: 'plan-preview-empty', text: 'No AI plan yet. Generate one from Event details.' }));
}

export function initOverview(root, store) {
  root.querySelector('[data-clear-event]').addEventListener('click', () => {
    if (!window.confirm('Delete the saved event from this browser? This cannot be undone.')) return;
    store.clearEvent();
    announce('Saved event deleted.');
    root.querySelector('h1')?.focus();
  });
  store.subscribe((state) => render(root, state));
  render(root, store.getState());
}
