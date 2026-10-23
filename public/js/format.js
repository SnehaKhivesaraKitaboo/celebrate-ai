import { parseISODate } from '../../shared/dates.js';

export function formatCurrency(amount, currency) {
  const value = Number.isFinite(amount) ? amount : 0;
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  // Intl throws "Currency code is required with currency style" when the code is
  // missing or invalid. Fall back to a plain number so the UI never crashes.
  if (!/^[A-Z]{3}$/.test(code)) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  }
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
  }
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
