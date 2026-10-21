import { summarizeBudget } from './budget.js';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PRIORITY_VALUES = Object.freeze(['high', 'medium', 'low']);
const PRIORITIES = new Set(PRIORITY_VALUES);

const LIMITS = Object.freeze({
  summary: 1200,
  themeName: 80,
  themeDescription: 600,
  paletteItem: 40,
  palette: [1, 6],
  category: 60,
  notes: 240,
  title: 140,
  question: 200,
  questions: [1, 5],
  tips: 400,
  idea: 240,
  assumption: 300,
  disclaimer: 500,
  items: [3, 12],
  tasks: [4, 20],
  vendors: [3, 12],
  ideas: [2, 8],
  assumptions: [1, 8],
  daysBefore: 1095,
});

const textSchema = (description) => ({ type: 'string', description });

/** JSON Schema sent to Gemini. The same shape is enforced again by normalizePlan. */
export const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['eventSummary', 'theme', 'budget', 'timeline', 'vendorChecklist', 'ideas', 'assumptions', 'disclaimer'],
  properties: {
    eventSummary: textSchema('Personalized summary of the event. No real business names.'),
    theme: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'palette'],
      properties: {
        name: textSchema('Short theme name.'),
        description: textSchema('How the theme should feel.'),
        palette: {
          type: 'array',
          minItems: LIMITS.palette[0],
          maxItems: LIMITS.palette[1],
          items: textSchema('A color name or hex code.'),
        },
      },
    },
    budget: {
      type: 'object',
      additionalProperties: false,
      required: ['currency', 'total', 'items'],
      properties: {
        currency: { type: 'string', description: 'Currency code copied from the event.' },
        total: { type: 'number', description: 'The event budget. Estimates should add up to this.' },
        items: {
          type: 'array',
          minItems: LIMITS.items[0],
          maxItems: LIMITS.items[1],
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'category', 'estimated', 'notes'],
            properties: {
              id: textSchema('Unique id prefixed exp-.'),
              category: textSchema('Expense category.'),
              estimated: { type: 'number', minimum: 0, description: 'Rough estimate, not a verified price.' },
              notes: textSchema('What the estimate covers.'),
            },
          },
        },
      },
    },
    timeline: {
      type: 'array',
      minItems: LIMITS.tasks[0],
      maxItems: LIMITS.tasks[1],
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'daysBeforeEvent', 'priority', 'category'],
        properties: {
          id: textSchema('Unique id prefixed task-.'),
          title: textSchema('Task title.'),
          daysBeforeEvent: { type: 'integer', minimum: 0, maximum: LIMITS.daysBefore, description: 'Days before the event date.' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: textSchema('Task category.'),
        },
      },
    },
    vendorChecklist: {
      type: 'array',
      minItems: LIMITS.vendors[0],
      maxItems: LIMITS.vendors[1],
      description: 'Categories and questions only. Never real vendor names, prices, or availability.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'category', 'questions', 'tips'],
        properties: {
          id: textSchema('Unique id prefixed ven-.'),
          category: textSchema('Vendor category.'),
          questions: {
            type: 'array',
            minItems: LIMITS.questions[0],
            maxItems: LIMITS.questions[1],
            items: textSchema('A question to ask when comparing quotes.'),
          },
          tips: textSchema('How to compare options. No business names.'),
        },
      },
    },
    ideas: {
      type: 'array',
      minItems: LIMITS.ideas[0],
      maxItems: LIMITS.ideas[1],
      items: textSchema('A practical creative idea.'),
    },
    assumptions: {
      type: 'array',
      minItems: LIMITS.assumptions[0],
      maxItems: LIMITS.assumptions[1],
      items: textSchema('An assumption behind the plan.'),
    },
    disclaimer: textSchema('States that costs are estimates and must be confirmed locally.'),
  },
};

const changeText = (description) => textSchema(description);

/** Same plan, plus the fields a revision must explain. */
export const REPLAN_RESPONSE_SCHEMA = {
  ...PLAN_RESPONSE_SCHEMA,
  required: [...PLAN_RESPONSE_SCHEMA.required, 'changeSummary', 'infeasible', 'eventChanges'],
  properties: {
    ...PLAN_RESPONSE_SCHEMA.properties,
    changeSummary: {
      type: 'array',
      maxItems: 8,
      description: 'Trade-offs caused by the requested change.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'before', 'after', 'reason'],
        properties: {
          area: changeText('What changed, such as Budget or Catering.'),
          before: changeText('The previous value.'),
          after: changeText('The new value.'),
          reason: changeText('Why this trade-off was made.'),
        },
      },
    },
    infeasible: {
      type: 'array',
      maxItems: 6,
      items: changeText('A constraint the change cannot satisfy.'),
    },
    eventChanges: {
      type: 'object',
      additionalProperties: false,
      description: 'Only event fields the request actually changes. Omit the rest.',
      properties: {
        budget: { type: 'number' },
        guestCount: { type: 'integer' },
        city: { type: 'string' },
        eventDate: { type: 'string' },
        theme: { type: 'string' },
        dietaryPreferences: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};

function fail(reason) {
  return { ok: false, reason, plan: null };
}

function cleanText(value, max, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_CHARS, '').trim().replace(/[ \t]+/g, ' ');
  if (cleaned.length > max) return null;
  if (!cleaned && !allowEmpty) return null;
  return cleaned;
}

function inRange(length, [min, max]) {
  return length >= min && length <= max;
}

function slugId(prefix, label, used) {
  const base = String(label || 'item').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'item';
  let id = `${prefix}-${base}`;
  let n = 2;
  while (used.has(id)) {
    id = `${prefix}-${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id.slice(0, 40);
}

function takeId(raw, prefix, label, used) {
  const candidate = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const valid = candidate.startsWith(`${prefix}-`) && ID_PATTERN.test(candidate) && candidate.length <= 40 && !used.has(candidate);
  if (!valid) return slugId(prefix, label, used);
  used.add(candidate);
  return candidate;
}

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null;
  return Math.round(value * 100) / 100;
}

function optionalMoney(value) {
  if (value == null || value === '') return null;
  return money(value);
}

function readQuotes(raw) {
  if (!Array.isArray(raw)) return [];
  const used = new Set();
  const quotes = [];
  for (const quote of raw) {
    if (quotes.length >= 8 || !quote || typeof quote !== 'object') continue;
    const label = cleanText(quote.label, 80);
    const amount = money(quote.amount);
    const notes = cleanText(typeof quote.notes === 'string' ? quote.notes : '', 200, { allowEmpty: true });
    if (!label || amount === null || notes === null) continue;
    quotes.push({
      id: takeId(quote.id, 'quote', label, used),
      label,
      amount,
      notes,
    });
  }
  return quotes;
}

function listOf(value, range, mapItem) {
  if (!Array.isArray(value) || !inRange(value.length, range)) return null;
  const mapped = [];
  for (const item of value) {
    const result = mapItem(item);
    if (result === null) return null;
    mapped.push(result);
  }
  return mapped;
}

/**
 * Validates a model plan and returns a clean object.
 * Currency, total, and allocated figures come from the event and from line items.
 */
export function normalizePlan(raw, event) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('not_object');
  if (!event || typeof event.budget !== 'number' || typeof event.currency !== 'string') return fail('event');

  const eventSummary = cleanText(raw.eventSummary, LIMITS.summary);
  if (!eventSummary) return fail('summary');

  const themeRaw = raw.theme;
  if (!themeRaw || typeof themeRaw !== 'object') return fail('theme');
  const themeName = cleanText(themeRaw.name, LIMITS.themeName);
  const themeDescription = cleanText(themeRaw.description, LIMITS.themeDescription);
  const palette = listOf(themeRaw.palette, LIMITS.palette, (color) => cleanText(color, LIMITS.paletteItem));
  if (!themeName || !themeDescription || !palette) return fail('theme');

  const items = listOf(raw.budget?.items, LIMITS.items, (item) => {
    if (!item || typeof item !== 'object') return null;
    const category = cleanText(item.category, LIMITS.category);
    const estimated = money(item.estimated);
    const notes = cleanText(item.notes, LIMITS.notes, { allowEmpty: true });
    if (!category || estimated === null || notes === null) return null;
    return { category, estimated, actual: optionalMoney(item.actual), notes, sourceId: item.id };
  });
  if (!items) return fail('budget');
  const itemIds = new Set();
  const budgetItems = items.map((item) => ({
    id: takeId(item.sourceId, 'exp', item.category, itemIds),
    category: item.category,
    estimated: item.estimated,
    actual: item.actual,
    notes: item.notes,
  }));

  const tasks = listOf(raw.timeline, LIMITS.tasks, (task) => {
    if (!task || typeof task !== 'object') return null;
    const title = cleanText(task.title, LIMITS.title);
    const category = cleanText(task.category, LIMITS.category);
    const days = task.daysBeforeEvent;
    if (!title || !category || !Number.isInteger(days) || days < 0 || days > LIMITS.daysBefore) return null;
    if (!PRIORITIES.has(task.priority)) return null;
    return { title, category, daysBeforeEvent: days, priority: task.priority, completed: task.completed === true, sourceId: task.id };
  });
  if (!tasks) return fail('timeline');
  const taskIds = new Set();
  const timeline = tasks
    .map((task) => ({
      id: takeId(task.sourceId, 'task', task.title, taskIds),
      title: task.title,
      daysBeforeEvent: task.daysBeforeEvent,
      priority: task.priority,
      category: task.category,
      completed: task.completed,
    }))
    .sort((a, b) => b.daysBeforeEvent - a.daysBeforeEvent);

  const vendors = listOf(raw.vendorChecklist, LIMITS.vendors, (vendor) => {
    if (!vendor || typeof vendor !== 'object') return null;
    const category = cleanText(vendor.category, LIMITS.category);
    const tips = cleanText(vendor.tips, LIMITS.tips);
    const questions = listOf(vendor.questions, LIMITS.questions, (question) => cleanText(question, LIMITS.question));
    if (!category || !tips || !questions) return null;
    return { category, tips, questions, quotes: readQuotes(vendor.quotes), sourceId: vendor.id };
  });
  if (!vendors) return fail('vendors');
  const vendorIds = new Set();
  const vendorChecklist = vendors.map((vendor) => ({
    id: takeId(vendor.sourceId, 'ven', vendor.category, vendorIds),
    category: vendor.category,
    questions: vendor.questions,
    tips: vendor.tips,
    quotes: vendor.quotes,
  }));

  const ideas = listOf(raw.ideas, LIMITS.ideas, (idea) => cleanText(idea, LIMITS.idea));
  if (!ideas) return fail('ideas');
  const assumptions = listOf(raw.assumptions, LIMITS.assumptions, (item) => cleanText(item, LIMITS.assumption));
  if (!assumptions) return fail('assumptions');
  const disclaimer = cleanText(raw.disclaimer, LIMITS.disclaimer);
  if (!disclaimer) return fail('disclaimer');

  const totals = summarizeBudget(budgetItems, event.budget);
  return {
    ok: true,
    reason: null,
    plan: {
      eventSummary,
      theme: { name: themeName, description: themeDescription, palette },
      budget: {
        currency: event.currency,
        total: event.budget,
        allocated: totals.allocated,
        difference: totals.difference,
        items: budgetItems,
      },
      timeline,
      vendorChecklist,
      ideas,
      assumptions,
      disclaimer,
    },
  };
}
