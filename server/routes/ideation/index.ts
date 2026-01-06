/**
 * Combined ideation router.
 *
 * Routes are split into smaller files for maintainability:
 * - session-routes.ts: Session CRUD, linking, naming
 * - artifact-routes.ts: Unified artifact store operations
 * - (main ideation.ts): Message handling, UI actions (too large to split easily)
 */

import { Router } from 'express';
import { sessionRouter } from './session-routes.js';
import { artifactRouter } from './artifact-routes.js';

export const splitIdeationRouter = Router();

// Mount session routes at /session and /sessions
splitIdeationRouter.use('/session', sessionRouter);
splitIdeationRouter.use('/sessions', sessionRouter);

// Mount artifact routes at /ideas (for unified file system)
splitIdeationRouter.use('/ideas', artifactRouter);
