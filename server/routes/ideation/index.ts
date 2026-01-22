/**
 * Combined ideation router.
 *
 * Routes are split into smaller files for maintainability:
 * - session-routes.ts: Session CRUD, linking, naming
 * - artifact-routes.ts: Unified artifact store operations
 * - graph-routes.ts: Graph visualization and data endpoints
 * - project-routes.ts: Project folder file system and spec management (Phase 9)
 * - (main ideation.ts): Message handling, UI actions (too large to split easily)
 */

import { Router } from "express";
import { sessionRouter } from "./session-routes.js";
import { artifactRouter } from "./artifact-routes.js";
import { graphRouter } from "./graph-routes.js";
import { projectRouter } from "./project-routes.js";

export const splitIdeationRouter = Router();

// Mount session routes at /session and /sessions
splitIdeationRouter.use("/session", sessionRouter);
splitIdeationRouter.use("/sessions", sessionRouter);

// Mount artifact routes at /ideas (for unified file system)
splitIdeationRouter.use("/ideas", artifactRouter);

// Mount graph routes at /session (graph endpoints are session-scoped)
splitIdeationRouter.use("/session", graphRouter);

// Mount project routes at /ideas (for project folder and spec management)
splitIdeationRouter.use("/ideas", projectRouter);
