import { summarizeBudget } from '../../../shared/budget.js';
import { deadlineFor, deadlineStatus } from '../../../shared/timeline.js';

const STATUS_LABELS = Object.freeze({
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  unknown: 'Date unavailable',
});

const PRIORITY_LABELS = Object.freeze({ high: 'High', medium: 'Medium', low: 'Low' });

/** View model. Budget totals are recalculated from line items. */
export function buildPlanModel(event, plan, today) {
  const totals = summarizeBudget(plan.budget.items, event.budget);
  const timeline = plan.timeline.map((task) => {
    const deadline = deadlineFor(event.eventDate, task.daysBeforeEvent);
    const status = deadlineStatus(today, deadline);
    return {
      ...task,
      deadline,
      status,
      statusLabel: STATUS_LABELS[status],
      priorityLabel: PRIORITY_LABELS[task.priority] ?? task.priority,
    };
  });
  const completedCount = timeline.filter((task) => task.completed).length;
  const barBase = Math.max(totals.allocated, event.budget, 0);
  return {
    summary: plan.eventSummary,
    theme: plan.theme,
    disclaimer: plan.disclaimer,
    assumptions: plan.assumptions,
    ideas: plan.ideas,
    currency: event.currency,
    budgetTotal: event.budget,
    allocated: totals.allocated,
    actual: totals.actual,
    remaining: totals.remaining,
    difference: totals.difference,
    matchesTotal: totals.matchesTotal,
    estimatesOver: totals.estimatesOver,
    actualOver: totals.actualOver,
    items: plan.budget.items,
    /** Category share of the larger of estimates/budget, for the CSS bar breakdown. */
    budgetBreakdown: plan.budget.items.map((item) => ({
      id: item.id,
      category: item.category,
      estimated: item.estimated,
      actual: typeof item.actual === 'number' ? item.actual : null,
      share: barBase > 0 ? Math.round((item.estimated / barBase) * 100) : 0,
      actualShare: barBase > 0 && typeof item.actual === 'number'
        ? Math.round((item.actual / barBase) * 100)
        : 0,
    })),
    timeline,
    completion: {
      completed: completedCount,
      total: timeline.length,
      percent: timeline.length ? Math.round((completedCount / timeline.length) * 100) : 0,
    },
    event: {
      eventType: event.eventType,
      eventDate: event.eventDate,
      city: event.city,
      guestCount: event.guestCount,
      theme: event.theme,
      budget: event.budget,
    },
    vendors: plan.vendorChecklist,
  };
}
