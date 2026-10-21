import { toISODate } from '../../../shared/dates.js';
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

function render(root, state) {
  const { event, savedAt } = state;
  root.querySelector('[data-overview-empty]').hidden = Boolean(event);
  root.querySelector('[data-overview-content]').hidden = !event;
  if (!event) return;

  const model = buildOverview(event, toISODate(new Date()), formatters);
  root.querySelector('[data-overview-stats]').replaceChildren(...model.stats.map(statCard));
  root.querySelector('[data-overview-details]').replaceChildren(...model.details.flatMap(detailRow));
  root.querySelector('[data-overview-saved]').textContent = savedAt
    ? `Last saved ${formatDateTime(savedAt)} in this browser.`
    : '';
  const planNote = root.querySelector('[data-overview-plan]');
  planNote.replaceChildren(state.plan
    ? el('a', { text: 'View the generated plan', attrs: { href: '#plan' } })
    : 'No AI plan yet. Generate one from Event details.');
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
