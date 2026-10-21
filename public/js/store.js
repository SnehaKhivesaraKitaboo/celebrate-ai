import { validateEvent } from '../../shared/eventValidation.js';
import { normalizePlan } from '../../shared/planSchema.js';

const STATE_VERSION = 1;
const EMPTY_STATE = Object.freeze({ event: null, plan: null, replan: null, savedAt: null });

function restoreReplan(value) {
  if (!value || typeof value !== 'object') return null;
  const list = (items) => (Array.isArray(items) ? items : []);
  return { changes: list(value.changes), notes: list(value.notes), infeasible: list(value.infeasible), conflicts: list(value.conflicts) };
}

function restore(data) {
  if (!data || data.version !== STATE_VERSION) return EMPTY_STATE;
  const result = validateEvent(data.event, { allowPast: true });
  if (!result.valid) return EMPTY_STATE;
  const normalized = data.plan ? normalizePlan(data.plan, result.value) : null;
  return {
    event: result.value,
    plan: normalized?.ok ? normalized.plan : null,
    replan: normalized?.ok ? restoreReplan(data.replan) : null,
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : null,
  };
}

/** Single source of truth for app state, persisted through the given storage adapter. */
export function createStore(storage, { now = () => new Date() } = {}) {
  let state = restore(storage.load());
  const listeners = new Set();

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function editPlan(change) {
    if (!state.event || !state.plan) return false;
    const normalized = normalizePlan(change(state.plan), state.event);
    if (!normalized.ok) return false;
    state = { ...state, plan: normalized.plan, savedAt: now().toISOString() };
    const persisted = storage.save({ version: STATE_VERSION, ...state });
    emit();
    return persisted;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Stores an already-validated event and, when present, its validated plan. */
    saveEvent(event, plan = null) {
      state = { event, plan, replan: null, savedAt: now().toISOString() };
      const persisted = storage.save({ version: STATE_VERSION, ...state });
      emit();
      return persisted;
    },
    updateExpense(id, patch) {
      return editPlan((plan) => ({
        ...plan,
        budget: { ...plan.budget, items: plan.budget.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) },
      }));
    },
    updateTask(id, patch) {
      return editPlan((plan) => ({
        ...plan,
        timeline: plan.timeline.map((task) => (task.id === id ? { ...task, ...patch } : task)),
      }));
    },
    setQuotes(vendorId, quotes) {
      return editPlan((plan) => ({
        ...plan,
        vendorChecklist: plan.vendorChecklist.map((vendor) => (vendor.id === vendorId ? { ...vendor, quotes } : vendor)),
      }));
    },
    saveReplan(revision) {
      const normalized = normalizePlan(revision.plan, revision.event);
      if (!normalized.ok) return false;
      state = {
        event: revision.event,
        plan: normalized.plan,
        replan: restoreReplan(revision),
        savedAt: now().toISOString(),
      };
      const persisted = storage.save({ version: STATE_VERSION, ...state });
      emit();
      return persisted;
    },
    clearEvent() {
      state = EMPTY_STATE;
      const cleared = storage.clear();
      emit();
      return cleared;
    },
  };
}
