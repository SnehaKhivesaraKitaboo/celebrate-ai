export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function spent(item) {
  return typeof item.actual === 'number' ? item.actual : 0;
}

/** Totals are always derived from line items. The model's own total is never used. */
export function summarizeBudget(items, total) {
  const allocated = roundMoney(items.reduce((sum, item) => sum + item.estimated, 0));
  const actual = roundMoney(items.reduce((sum, item) => sum + spent(item), 0));
  const difference = roundMoney(allocated - total);
  const remaining = roundMoney(total - actual);
  return {
    allocated,
    actual,
    remaining,
    difference,
    matchesTotal: difference === 0,
    estimatesOver: allocated > total,
    actualOver: actual > total,
  };
}
