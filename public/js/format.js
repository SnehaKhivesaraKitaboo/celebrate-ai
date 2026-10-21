import { parseISODate } from '../../shared/dates.js';

export function formatCurrency(amount, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

export function formatDate(isoDate) {
  const date = parseISODate(isoDate);
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' }).format(date);
}

export function formatDateTime(isoString) {
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? value;
}
