import { EVENT_TYPES, DIETARY_OPTIONS } from '../../../shared/constants.js';
import { daysBetween } from '../../../shared/dates.js';

export function describeCountdown(today, eventDate) {
  const days = daysBetween(today, eventDate);
  if (days === null) return { value: '—', meta: '' };
  if (days < 0) return { value: 'Event date passed', meta: `${Math.abs(days)} day${days === -1 ? '' : 's'} ago` };
  if (days === 0) return { value: 'Today', meta: 'Enjoy the celebration' };
  return { value: `${days} day${days === 1 ? '' : 's'}`, meta: 'until the event' };
}

/** Pure view model for the overview dashboard; all figures are computed locally. */
export function buildOverview(event, today, fmt) {
  const typeLabel = EVENT_TYPES.find((t) => t.value === event.eventType)?.label ?? event.eventType;
  const countdown = describeCountdown(today, event.eventDate);
  const perGuest = event.budget / event.guestCount;
  const dietary = event.dietaryPreferences.map((value) => DIETARY_OPTIONS.find((d) => d.value === value)?.label ?? value);

  return {
    stats: [
      { label: 'Countdown', value: countdown.value, meta: countdown.meta, accent: true },
      { label: 'Guests', value: fmt.number(event.guestCount), meta: 'expected' },
      { label: 'Total budget', value: fmt.currency(event.budget, event.currency), meta: event.currency },
      { label: 'Budget per guest', value: fmt.currency(perGuest, event.currency), meta: 'before allocation' },
    ],
    details: [
      { term: 'Event type', value: typeLabel },
      { term: 'Date', value: fmt.date(event.eventDate) },
      { term: 'City', value: event.city },
      { term: 'Theme', value: event.theme || 'Not specified' },
      { term: 'Dietary preferences', tags: dietary, value: dietary.length ? '' : 'None specified' },
      { term: 'Special requirements', value: event.specialRequirements || 'None' },
    ],
  };
}
