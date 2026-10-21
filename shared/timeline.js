import { daysBetween, parseISODate } from './dates.js';

/** Deadline as YYYY-MM-DD, counted back from the event date. The model never supplies calendar dates. */
export function deadlineFor(eventDate, daysBeforeEvent) {
  const date = parseISODate(eventDate);
  if (!date || !Number.isInteger(daysBeforeEvent) || daysBeforeEvent < 0) return null;
  date.setUTCDate(date.getUTCDate() - daysBeforeEvent);
  return date.toISOString().slice(0, 10);
}

export function deadlineStatus(today, deadline) {
  const days = daysBetween(today, deadline);
  if (days === null) return 'unknown';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return 'upcoming';
}
