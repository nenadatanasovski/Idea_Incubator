// agents/sia/observable-sia.ts
// OBS-108: Re-export from index.ts for backward compatibility
// The actual implementation is now in index.ts per spec requirement

export {
  ObservableSIA,
  SIA,
  createObservableSIA,
  type SIAAnalysisOptions,
  type SIAAnalysisResult,
} from "./index.js";
