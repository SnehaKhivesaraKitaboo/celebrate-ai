const TEXT_AREAS = new Set(['Guests', 'City', 'Date', 'Theme']);

export function formatChangeValue(area, value, currency, side, fmt) {
  if (value == null) return side === 'before' ? 'Not in the plan' : 'Removed';
  if (typeof value === 'number' && !TEXT_AREAS.has(area)) return fmt.currency(value, currency);
  return String(value);
}

export function buildPrintSections(event, model, replan, fmt) {
  const sections = [
    {
      heading: 'Event',
      lines: [
        `${fmt.date(event.eventDate)} · ${event.city}`,
        `${event.guestCount} guests`,
        `Budget ${fmt.currency(event.budget, event.currency)}`,
        model.summary,
        `${model.theme.name}. ${model.theme.description}`,
      ],
    },
    {
      heading: 'Budget',
      lines: [
        ...model.items.map((item) => `${item.category}: estimate ${fmt.currency(item.estimated, model.currency)}, actual ${item.actual == null ? 'not entered' : fmt.currency(item.actual, model.currency)}`),
        `Estimated total ${fmt.currency(model.allocated, model.currency)}`,
        `Actual spending ${fmt.currency(model.actual, model.currency)}`,
        `Remaining ${fmt.currency(model.remaining, model.currency)}`,
      ],
    },
    {
      heading: 'Timeline',
      lines: model.timeline.map((task) => `${task.completed ? 'Done' : task.statusLabel}: ${task.title} · ${task.priorityLabel} · ${task.deadline ? fmt.date(task.deadline) : 'Date unavailable'}`),
    },
    {
      heading: 'Vendors',
      lines: model.vendors.flatMap((vendor) => [
        vendor.category,
        ...(vendor.quotes ?? []).map((quote) => `${quote.label}: ${fmt.currency(quote.amount, model.currency)}`),
      ]),
    },
    { heading: 'Ideas', lines: model.ideas },
    { heading: 'Assumptions', lines: model.assumptions },
    { heading: 'Disclaimer', lines: [model.disclaimer, 'These figures are planning estimates, not verified market prices, quotes, or confirmed bookings.'] },
  ];
  if (replan?.changes?.length) {
    sections.push({
      heading: 'Latest change',
      lines: replan.changes.map((change) => `${change.area}: ${formatChangeValue(change.area, change.before, model.currency, 'before', fmt)} → ${formatChangeValue(change.area, change.after, model.currency, 'after', fmt)}`),
    });
  }
  return sections;
}
