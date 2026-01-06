// =============================================================================
// FILE: frontend/src/selectors/ideationSelectors.ts
// Memoized selectors for ideation state
// =============================================================================

import type { IdeationStore, ArtifactState, Artifact, ClassificationInfo } from '../types/ideation-state';

// -----------------------------------------------------------------------------
// Simple Memoization Helper
// Similar to reselect - caches last result based on input reference equality
// -----------------------------------------------------------------------------

function createSelector<TInput, TOutput>(
  inputSelector: (state: IdeationStore) => TInput,
  resultFn: (input: TInput) => TOutput
): (state: IdeationStore) => TOutput {
  let lastInput: TInput | undefined;
  let lastResult: TOutput | undefined;

  return (state: IdeationStore): TOutput => {
    const input = inputSelector(state);
    if (input === lastInput && lastResult !== undefined) {
      return lastResult;
    }
    lastInput = input;
    lastResult = resultFn(input);
    return lastResult;
  };
}

// Multi-input selector for combining multiple state slices
function createSelectorMulti<TInputs extends unknown[], TOutput>(
  inputSelectors: { [K in keyof TInputs]: (state: IdeationStore) => TInputs[K] },
  resultFn: (...inputs: TInputs) => TOutput
): (state: IdeationStore) => TOutput {
  let lastInputs: TInputs | undefined;
  let lastResult: TOutput | undefined;

  return (state: IdeationStore): TOutput => {
    const inputs = inputSelectors.map(selector => selector(state)) as TInputs;

    // Check if any input changed
    const inputsChanged = !lastInputs || inputs.some((input, i) => input !== lastInputs![i]);

    if (!inputsChanged && lastResult !== undefined) {
      return lastResult;
    }

    lastInputs = inputs;
    lastResult = resultFn(...inputs);
    return lastResult;
  };
}

// -----------------------------------------------------------------------------
// Base Selectors (not memoized - simple property access)
// Exported for use by other selectors and components
// -----------------------------------------------------------------------------

export const selectArtifactState = (state: IdeationStore): ArtifactState => state.artifacts;
export const selectArtifacts = (state: IdeationStore): Artifact[] => state.artifacts.artifacts;
export const selectSelectedPath = (state: IdeationStore): string | null => state.artifacts.selectedArtifactPath;
export const selectClassifications = (state: IdeationStore): Record<string, ClassificationInfo> =>
  state.artifacts.artifactClassifications;

// -----------------------------------------------------------------------------
// Memoized Selectors
// -----------------------------------------------------------------------------

/**
 * Returns the currently linked idea or null
 */
export const selectLinkedIdea = (state: IdeationStore): { userSlug: string; ideaSlug: string } | null => {
  return state.artifacts.linkedIdea;
};

/**
 * Returns the current view mode ('files' or 'sessions')
 */
export const selectViewMode = (state: IdeationStore): 'files' | 'sessions' => {
  return state.artifacts.viewMode;
};

/**
 * Groups artifacts by sessionId
 * Returns a Record where keys are sessionIds and values are arrays of artifacts
 * Artifacts without sessionId are grouped under '_template' key
 */
export const selectArtifactsBySession = createSelector(
  selectArtifacts,
  (artifacts: Artifact[]): Record<string, Artifact[]> => {
    const grouped: Record<string, Artifact[]> = {};

    for (const artifact of artifacts) {
      // Use artifact.id as a fallback key extraction method
      // In the unified file system, sessionId may be part of the file metadata
      // For now, we'll check if there's a sessionId-like pattern in the id or use a default
      const sessionKey = extractSessionId(artifact) || '_template';

      if (!grouped[sessionKey]) {
        grouped[sessionKey] = [];
      }
      grouped[sessionKey].push(artifact);
    }

    // Sort artifacts within each session by date (newest first)
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
    }

    return grouped;
  }
);

/**
 * Groups artifacts by directory path
 * Returns a Record where keys are folder paths and values are arrays of artifacts
 * Files in root are grouped under '/' key
 */
export const selectArtifactsByFolder = createSelector(
  selectArtifacts,
  (artifacts: Artifact[]): Record<string, Artifact[]> => {
    const grouped: Record<string, Artifact[]> = {};

    for (const artifact of artifacts) {
      // Extract folder path from artifact title or id
      // Assumes artifacts have a path-like structure in their identifier/title
      const folderPath = extractFolderPath(artifact);

      if (!grouped[folderPath]) {
        grouped[folderPath] = [];
      }
      grouped[folderPath].push(artifact);
    }

    // Sort: folders first (alphabetically), then files by date (newest first)
    const sortedGrouped: Record<string, Artifact[]> = {};
    const keys = Object.keys(grouped).sort((a, b) => {
      // Root folder comes first
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });

    for (const key of keys) {
      sortedGrouped[key] = grouped[key].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
    }

    return sortedGrouped;
  }
);

/**
 * Returns the full artifact object for the selected path
 * Returns undefined if no artifact is selected or not found
 */
export const selectSelectedArtifact = createSelectorMulti(
  [selectArtifacts, selectSelectedPath],
  (artifacts: Artifact[], selectedPath: string | null): Artifact | undefined => {
    if (!selectedPath) {
      return undefined;
    }

    // Match by id, title, or identifier
    return artifacts.find(artifact =>
      artifact.id === selectedPath ||
      artifact.title === selectedPath ||
      artifact.identifier === selectedPath
    );
  }
);

/**
 * Returns artifact classifications record
 */
export const selectArtifactClassifications = (state: IdeationStore): Record<string, ClassificationInfo> => {
  return state.artifacts.artifactClassifications;
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Extracts sessionId from an artifact
 * Looks for sessionId in the artifact's id or uses pattern matching
 */
function extractSessionId(artifact: Artifact): string | null {
  // If the artifact ID contains a session prefix (e.g., "session_123_artifact_456")
  const sessionMatch = artifact.id.match(/^session[_-]?([a-zA-Z0-9-]+)/i);
  if (sessionMatch) {
    return sessionMatch[1];
  }

  // Check identifier for session pattern
  if (artifact.identifier) {
    const identMatch = artifact.identifier.match(/^session[_-]?([a-zA-Z0-9-]+)/i);
    if (identMatch) {
      return identMatch[1];
    }
  }

  // No session ID found - could be a template file
  return null;
}

/**
 * Extracts folder path from an artifact
 * Uses the artifact's title or identifier to determine folder structure
 */
function extractFolderPath(artifact: Artifact): string {
  // Check if title contains path separators
  if (artifact.title.includes('/')) {
    const parts = artifact.title.split('/');
    parts.pop(); // Remove filename
    return parts.length > 0 ? parts.join('/') : '/';
  }

  // Check identifier for path structure
  if (artifact.identifier && artifact.identifier.includes('/')) {
    const parts = artifact.identifier.split('/');
    parts.pop();
    return parts.length > 0 ? parts.join('/') : '/';
  }

  // No folder structure - root folder
  return '/';
}

// -----------------------------------------------------------------------------
// Type Exports
// -----------------------------------------------------------------------------

export type { IdeationStore, Artifact, ArtifactState, ClassificationInfo };
