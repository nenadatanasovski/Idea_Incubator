// server/routes/validation.ts

import { Router, Request, Response } from 'express';
import { ValidationOrchestrator } from '../../agents/validation/orchestrator.js';
import { LEVEL_CONFIGS } from '../../agents/validation/level-configs.js';
import { saveValidationRun, saveValidatorResult, getValidationRun, getValidatorResults, getValidationHistory } from '../../agents/validation/db.js';

const router = Router();
const orchestrator = new ValidationOrchestrator();

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { level, buildId, options } = req.body;
    const { run, results } = await orchestrator.run({ level, buildId, options });

    await saveValidationRun(run);
    for (const result of results) {
      await saveValidatorResult(result);
    }

    res.json({ run, results });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/levels', (_req: Request, res: Response) => {
  res.json(LEVEL_CONFIGS);
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await getValidationHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await getValidationRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Validation run not found' });
      return;
    }
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/results', async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await getValidationRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Validation run not found' });
      return;
    }
    const results = await getValidatorResults(req.params.id);
    res.json({ run, results });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
