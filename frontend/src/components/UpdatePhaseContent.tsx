import { useState, useEffect } from "react";
import {
  Loader2,
  Sparkles,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  generateUpdateSuggestion,
  getUpdateSuggestion,
  applyUpdateSuggestion,
  type UpdateSuggestion,
} from "../api/client";

/**
 * Strip YAML frontmatter from markdown content
 * Frontmatter is text between --- delimiters at the start of content
 */
function stripFrontmatter(content: string): string {
  if (!content) return "";

  // Match frontmatter: starts with ---, ends with ---, may have content between
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n?/;
  return content.replace(frontmatterRegex, "").trim();
}

interface UpdatePhaseContentProps {
  ideaSlug: string;
  currentTitle: string;
  currentSummary: string | null;
  onApplied: () => void;
  onSkip: () => void;
}

export default function UpdatePhaseContent({
  ideaSlug,
  currentTitle,
  currentSummary,
  onApplied,
  onSkip,
}: UpdatePhaseContentProps) {
  const [suggestion, setSuggestion] = useState<UpdateSuggestion | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  // Load existing suggestion on mount
  useEffect(() => {
    const loadSuggestion = async () => {
      try {
        const saved = await getUpdateSuggestion(ideaSlug);
        if (saved) {
          setSuggestion(saved);
        }
      } catch (err) {
        console.error("Failed to load update suggestion:", err);
      }
    };
    loadSuggestion();
  }, [ideaSlug]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateUpdateSuggestion(ideaSlug);
      setSuggestion(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!suggestion) return;
    setIsApplying(true);
    setError(null);
    try {
      await applyUpdateSuggestion(ideaSlug, suggestion.id);
      // Show success state immediately for better UX
      setIsApplying(false);
      setApplySuccess(true);
      // Brief delay to show success before transition
      setTimeout(() => {
        onApplied();
      }, 300);
    } catch (err) {
      setError((err as Error).message);
      setIsApplying(false);
    }
  };

  // Loading state
  if (isGenerating) {
    return (
      <div className="card text-center py-12">
        <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary-500 animate-spin" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Generating AI Updates
        </h3>
        <p className="text-gray-500">
          Analysing Q&A, User Profile, chosen positioning strategy, and market
          analysis to suggest changes to the current Idea...
        </p>
      </div>
    );
  }

  // No suggestion yet
  if (!suggestion) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                AI-Powered Idea Refinement
              </h3>
              <p className="text-gray-600 mb-4">
                Based on your positioning analysis, our AI can suggest updates
                to make your idea more compelling, focused, and aligned with
                your chosen strategic approach.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Current Idea
                </h4>
                <p className="font-medium text-gray-900">{currentTitle}</p>
                {currentSummary && (
                  <p className="text-sm text-gray-600 mt-1">{currentSummary}</p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={handleGenerate} className="btn btn-primary">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Suggestions
                </button>
                <button onClick={onSkip} className="btn btn-secondary">
                  Skip to Evaluation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show suggestion
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                AI Suggestions Ready
              </h3>
              <p className="text-sm text-gray-500">
                Review the suggested changes and apply them to your idea
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </button>
        </div>

        {/* Positioning info */}
        {(suggestion.positioningStrategy || suggestion.targetSegment) && (
          <div className="flex gap-4 mb-4">
            {suggestion.positioningStrategy && (
              <div className="flex-1 p-3 bg-purple-50 rounded-lg">
                <div className="text-xs text-purple-600 font-medium">
                  Positioning Strategy
                </div>
                <div className="text-sm text-gray-900">
                  {suggestion.positioningStrategy}
                </div>
              </div>
            )}
            {suggestion.targetSegment && (
              <div className="flex-1 p-3 bg-cyan-50 rounded-lg">
                <div className="text-xs text-cyan-600 font-medium">
                  Target Segment
                </div>
                <div className="text-sm text-gray-900">
                  {suggestion.targetSegment}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title comparison */}
      <div className="card">
        <h4 className="text-sm font-medium text-gray-500 mb-3">Title</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Current</div>
            <div className="text-gray-900">{currentTitle}</div>
          </div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-xs text-green-600 mb-1">Suggested</div>
            <div className="text-gray-900 font-medium">
              {suggestion.suggestedTitle}
            </div>
          </div>
        </div>
        {suggestion.changeRationale?.title && (
          <p className="text-xs text-gray-500 mt-2 italic">
            {suggestion.changeRationale.title}
          </p>
        )}
      </div>

      {/* Summary comparison */}
      <div className="card">
        <h4 className="text-sm font-medium text-gray-500 mb-3">Summary</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Current</div>
            <div className="text-gray-900 text-sm">
              {currentSummary || "No summary"}
            </div>
          </div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-xs text-green-600 mb-1">Suggested</div>
            <div className="text-gray-900 text-sm">
              {suggestion.suggestedSummary}
            </div>
          </div>
        </div>
        {suggestion.changeRationale?.summary && (
          <p className="text-xs text-gray-500 mt-2 italic">
            {suggestion.changeRationale.summary}
          </p>
        )}
      </div>

      {/* Content (collapsible) */}
      <div className="card">
        <button
          onClick={() => setShowContent(!showContent)}
          className="w-full flex items-center justify-between"
        >
          <h4 className="text-sm font-medium text-gray-500">Full Content</h4>
          {showContent ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        {showContent && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripFrontmatter(suggestion.suggestedContent)}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Rationale (collapsible) */}
      <div className="card">
        <button
          onClick={() => setShowRationale(!showRationale)}
          className="w-full flex items-center justify-between"
        >
          <h4 className="text-sm font-medium text-gray-500">
            Why These Changes?
          </h4>
          {showRationale ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        {showRationale && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-700">
              {suggestion.changeRationale?.overall}
            </p>
            {suggestion.keyInsightsIncorporated &&
              suggestion.keyInsightsIncorporated.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">
                    Key insights incorporated:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.keyInsightsIncorporated.map((insight, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                      >
                        {insight}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button onClick={onSkip} className="btn btn-secondary">
          <X className="h-4 w-4 mr-2" />
          Skip Updates
        </button>
        <button
          onClick={handleApply}
          disabled={isApplying || applySuccess}
          className={`btn ${applySuccess ? "btn-success bg-green-600 hover:bg-green-600" : "btn-primary"}`}
        >
          {applySuccess ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Applied!
            </>
          ) : isApplying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Apply Suggestions
            </>
          )}
        </button>
      </div>
    </div>
  );
}
