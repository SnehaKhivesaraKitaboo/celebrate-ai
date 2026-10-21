export const EVENT_TYPES = Object.freeze([
  { value: 'wedding', label: 'Wedding' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'community', label: 'Community event' },
]);

export const CURRENCIES = Object.freeze(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD']);

export const DIETARY_OPTIONS = Object.freeze([
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'nut-free', label: 'Nut-free' },
  { value: 'dairy-free', label: 'Dairy-free' },
]);

export const EVENT_LIMITS = Object.freeze({
  cityMin: 2,
  cityMax: 80,
  guestMin: 1,
  guestMax: 5000,
  budgetMin: 1,
  budgetMax: 1_000_000_000,
  themeMax: 80,
  specialRequirementsMax: 500,
  maxYearsAhead: 3,
});
