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
    timeline: plan.timeline.map((task) => {
      const deadline = deadlineFor(event.eventDate, task.daysBeforeEvent);
      const status = deadlineStatus(today, deadline);
      return {
        ...task,
        deadline,
        status,
        statusLabel: STATUS_LABELS[status],
        priorityLabel: PRIORITY_LABELS[task.priority] ?? task.priority,
      };
    }),
    vendors: plan.vendorChecklist,
  };
}
