const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad(value) {
  return String(value).padStart(2, '0');
}

/** Local calendar date as YYYY-MM-DD, so "today" matches the user's wall clock. */
export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a YYYY-MM-DD string into a UTC-midnight Date, or null if it is not a real calendar date. */
export function parseISODate(value) {
  const match = typeof value === 'string' ? ISO_DATE.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealDate ? date : null;
}

/** Whole days from one ISO date to another; negative when `to` is earlier. */
export function daysBetween(fromISO, toISO) {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

export function addYears(isoDate, years) {
  const date = parseISODate(isoDate);
  if (!date) return null;
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}
