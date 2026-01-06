/**
 * Artifact management routes for the unified file system.
 * Handles CRUD operations for artifacts stored in idea folders.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  saveUnifiedArtifact,
  loadUnifiedArtifact,
  listUnifiedArtifacts,
  deleteUnifiedArtifact,
  UnifiedArtifact,
  CreateArtifactInput,
  ArtifactType,
  timeoutMiddleware,
} from './shared.js';

export const artifactRouter = Router();

// Apply timeout middleware
artifactRouter.use(timeoutMiddleware);

// ============================================================================
// GET /ideas/:userSlug/:ideaSlug/artifacts
// ============================================================================
// Get all artifacts for an idea (filesystem-based unified artifact store)

artifactRouter.get('/:userSlug/:ideaSlug/artifacts', async (req: Request, res: Response) => {
  try {
    const { userSlug, ideaSlug } = req.params;

    if (!userSlug || !ideaSlug) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'userSlug and ideaSlug are required',
      });
    }

    console.log(`[IdeaArtifacts] Listing artifacts for ${userSlug}/${ideaSlug}`);

    const artifacts = await listUnifiedArtifacts(userSlug, ideaSlug);

    console.log(`[IdeaArtifacts] Found ${artifacts.length} artifacts`);

    res.json({
      success: true,
      data: {
        artifacts,
        count: artifacts.length,
      },
    });

  } catch (error) {
    console.error('[IdeaArtifacts] Error listing artifacts:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// POST /ideas/:userSlug/:ideaSlug/artifacts
// ============================================================================
// Create a new artifact in an idea folder

const CreateIdeaArtifactSchema = z.object({
  type: z.enum(['research', 'mermaid', 'markdown', 'code', 'analysis', 'comparison', 'idea-summary', 'template']),
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  sessionId: z.string().optional(),
  language: z.string().optional(),
  queries: z.array(z.string()).optional(),
  identifier: z.string().optional(),
  filePath: z.string().optional(),
});

artifactRouter.post('/:userSlug/:ideaSlug/artifacts', async (req: Request, res: Response) => {
  try {
    const { userSlug, ideaSlug } = req.params;

    if (!userSlug || !ideaSlug) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'userSlug and ideaSlug are required',
      });
    }

    const parseResult = CreateIdeaArtifactSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { type, title, content, sessionId, language, queries, identifier, filePath } = parseResult.data;

    console.log(`[IdeaArtifacts] Creating artifact "${title}" for ${userSlug}/${ideaSlug}`);

    const input: CreateArtifactInput = {
      type: type as ArtifactType,
      title,
      content,
      sessionId,
      language,
      queries,
      identifier,
      filePath,
    };

    const artifact: UnifiedArtifact = await saveUnifiedArtifact(userSlug, ideaSlug, input);

    console.log(`[IdeaArtifacts] Created artifact ${artifact.id} at ${artifact.filePath}`);

    res.status(201).json({
      success: true,
      data: {
        artifact,
      },
    });

  } catch (error) {
    console.error('[IdeaArtifacts] Error creating artifact:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// GET /ideas/:userSlug/:ideaSlug/artifacts/:filePath
// ============================================================================
// Get a specific artifact by file path

artifactRouter.get('/:userSlug/:ideaSlug/artifacts/:filePath(*)', async (req: Request, res: Response) => {
  try {
    const { userSlug, ideaSlug, filePath } = req.params;

    if (!userSlug || !ideaSlug || !filePath) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'userSlug, ideaSlug, and filePath are required',
      });
    }

    console.log(`[IdeaArtifacts] Loading artifact ${filePath} for ${userSlug}/${ideaSlug}`);

    const artifact = await loadUnifiedArtifact(userSlug, ideaSlug, filePath);

    if (!artifact) {
      return res.status(404).json({
        error: 'Not found',
        message: `Artifact not found: ${filePath}`,
      });
    }

    console.log(`[IdeaArtifacts] Loaded artifact ${artifact.id}`);

    res.json({
      success: true,
      data: {
        artifact,
      },
    });

  } catch (error) {
    console.error('[IdeaArtifacts] Error loading artifact:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// DELETE /ideas/:userSlug/:ideaSlug/artifacts/:filePath
// ============================================================================
// Delete an artifact by file path

artifactRouter.delete('/:userSlug/:ideaSlug/artifacts/:filePath(*)', async (req: Request, res: Response) => {
  try {
    const { userSlug, ideaSlug, filePath } = req.params;

    if (!userSlug || !ideaSlug || !filePath) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'userSlug, ideaSlug, and filePath are required',
      });
    }

    console.log(`[IdeaArtifacts] Deleting artifact ${filePath} for ${userSlug}/${ideaSlug}`);

    const deleted = await deleteUnifiedArtifact(userSlug, ideaSlug, filePath);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not found',
        message: `Artifact not found: ${filePath}`,
      });
    }

    console.log(`[IdeaArtifacts] Deleted artifact ${filePath}`);

    res.json({
      success: true,
      message: 'Artifact deleted',
    });

  } catch (error) {
    console.error('[IdeaArtifacts] Error deleting artifact:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
