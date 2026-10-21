import { Router } from 'express';
import { validateEvent } from '../../shared/eventValidation.js';
import { normalizePlan } from '../../shared/planSchema.js';
import { cleanChange } from '../../shared/replan.js';
import { createRateLimit } from '../middleware/rateLimit.js';

export function planRoutes(planService, { windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  const router = Router();
  const rateLimit = createRateLimit({ windowMs, max });

  router.post('/plan', rateLimit, async (req, res) => {
    const result = validateEvent(req.body);
    if (!result.valid) {
      res.status(400).json({ error: 'Check the event details.', code: 'invalid_event', fields: result.errors });
      return;
    }
    const plan = await planService.createPlan(result.value);
    res.json({ plan });
  });

  router.post('/replan', rateLimit, async (req, res) => {
    const eventResult = validateEvent(req.body?.event);
    if (!eventResult.valid) {
      res.status(400).json({ error: 'Check the event details.', code: 'invalid_event', fields: eventResult.errors });
      return;
    }
    const change = cleanChange(req.body?.change);
    if (!change) {
      res.status(400).json({ error: 'Describe the change you want.', code: 'invalid_change' });
      return;
    }
    const current = normalizePlan(req.body?.plan, eventResult.value);
    if (!current.ok) {
      res.status(400).json({ error: 'The current plan could not be read. Generate a plan first.', code: 'invalid_plan' });
      return;
    }
    const revised = await planService.replan(eventResult.value, current.plan, change);
    res.json({
      event: revised.event,
      plan: revised.plan,
      changes: revised.changes,
      notes: revised.notes,
      infeasible: revised.infeasible,
      conflicts: revised.conflicts,
    });
  });

  return router;
}
