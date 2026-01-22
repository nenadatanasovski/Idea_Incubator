/**
 * BlockTypeInspector Component
 * Specialized inspector panels for each block type
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.3
 */

import type { GraphNode } from "../../types/graph";
import { nodeColors } from "../../types/graph";

export interface BlockTypeInspectorProps {
  node: GraphNode;
  onRecalculate?: () => void;
  onNavigate?: (nodeId: string) => void;
  onRegenerate?: () => void;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Progress bar component for action blocks
 */
function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {completed}/{total}
        </span>
        <span>{percentage}%</span>
      </div>
      <div
        className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all ${
            percentage >= 100
              ? "bg-green-500"
              : percentage >= 50
                ? "bg-blue-500"
                : "bg-amber-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Status badge component
 */
function StatusBadge({
  status,
  variant = "default",
}: {
  status: string;
  variant?: "default" | "critical" | "warning" | "success";
}) {
  const variantStyles: Record<string, string> = {
    default: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    critical: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
    warning:
      "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
    success:
      "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]}`}
    >
      {status}
    </span>
  );
}

/**
 * Property row component
 */
function PropertyRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-2 py-1.5">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white text-right">
        {children || value}
      </span>
    </div>
  );
}

/**
 * Section header component
 */
function SectionHeader({ title }: { title: string }) {
  return (
    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
      {title}
    </h4>
  );
}

// ============================================================================
// Block Type Panels
// ============================================================================

/**
 * Assumption Panel
 * Shows criticality, validation status, implied_by, validation method
 */
function AssumptionPanel({
  node,
  onNavigate,
}: {
  node: GraphNode;
  onNavigate?: (nodeId: string) => void;
}) {
  const getCriticalityVariant = (
    criticality?: string,
  ): "critical" | "warning" | "default" => {
    if (criticality === "critical") return "critical";
    if (criticality === "important") return "warning";
    return "default";
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Assumption Details" />

      {node.criticality && (
        <div className="flex items-center gap-2">
          <StatusBadge
            status={node.criticality.toUpperCase()}
            variant={getCriticalityVariant(node.criticality)}
          />
          {node.assumptionStatus && (
            <StatusBadge
              status={node.assumptionStatus}
              variant={
                node.assumptionStatus === "validated" ? "success" : "default"
              }
            />
          )}
        </div>
      )}

      <div className="space-y-1">
        {node.impliedBy && (
          <PropertyRow label="Implied By">
            <button
              onClick={() => onNavigate?.(node.impliedBy!)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {node.impliedBy}
            </button>
          </PropertyRow>
        )}
        {node.surfacedBy && (
          <PropertyRow label="Surfaced By" value={node.surfacedBy} />
        )}
        {node.validationMethod && (
          <PropertyRow
            label="Validation Method"
            value={node.validationMethod}
          />
        )}
        {node.validatedBy && (
          <PropertyRow label="Validated By" value={node.validatedBy} />
        )}
        {node.validatedAt && (
          <PropertyRow
            label="Validated At"
            value={new Date(node.validatedAt).toLocaleDateString()}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Derived Panel
 * Shows formula, computed value, staleness, recalculate, override
 */
function DerivedPanel({
  node,
  onRecalculate,
}: {
  node: GraphNode;
  onRecalculate?: () => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Derived Value" />

      {node.stale && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            STALE
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Source data has changed
          </span>
        </div>
      )}

      <div className="space-y-1">
        {node.formula && (
          <PropertyRow label="Formula">
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {node.formula}
            </code>
          </PropertyRow>
        )}
        {node.computedValue !== undefined && (
          <PropertyRow
            label="Computed Value"
            value={
              typeof node.computedValue === "number"
                ? node.computedValue.toLocaleString()
                : String(node.computedValue)
            }
          />
        )}
        {node.computedAt && (
          <PropertyRow
            label="Computed At"
            value={new Date(node.computedAt).toLocaleString()}
          />
        )}
        {node.overrideValue !== undefined && (
          <PropertyRow
            label="Override Value"
            value={String(node.overrideValue)}
          />
        )}
        {node.overrideReason && (
          <PropertyRow label="Override Reason" value={node.overrideReason} />
        )}
      </div>

      {onRecalculate && (
        <button
          onClick={onRecalculate}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          aria-label="Recalculate"
        >
          Recalculate
        </button>
      )}
    </div>
  );
}

/**
 * Action Panel
 * Shows progress bar, due date, evidence list, outcome
 */
function ActionPanel({ node }: { node: GraphNode }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Action Details" />

      {node.actionType && (
        <PropertyRow label="Action Type" value={node.actionType} />
      )}

      {node.requiredCount !== undefined &&
        node.completedCount !== undefined && (
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Progress
            </span>
            <ProgressBar
              completed={node.completedCount}
              total={node.requiredCount}
            />
          </div>
        )}

      <div className="space-y-1">
        {node.dueDate && (
          <PropertyRow label="Due Date">
            <span
              className={
                new Date(node.dueDate) < new Date()
                  ? "text-red-600 dark:text-red-400"
                  : ""
              }
            >
              {new Date(node.dueDate).toLocaleDateString()}
            </span>
          </PropertyRow>
        )}
        {node.assignedTo && (
          <PropertyRow label="Assigned To" value={node.assignedTo} />
        )}
        {node.outcome && (
          <PropertyRow label="Outcome">
            <StatusBadge
              status={node.outcome}
              variant={
                node.outcome === "validated"
                  ? "success"
                  : node.outcome === "invalidated"
                    ? "critical"
                    : "default"
              }
            />
          </PropertyRow>
        )}
      </div>
    </div>
  );
}

/**
 * External Panel
 * Shows URL health, snapshot, domain credibility, extracted facts
 */
function ExternalPanel({ node }: { node: GraphNode }) {
  const getUrlStatusVariant = (
    status?: string,
  ): "success" | "warning" | "critical" | "default" => {
    if (status === "alive") return "success";
    if (status === "redirected" || status === "changed") return "warning";
    if (status === "dead") return "critical";
    return "default";
  };

  const getCredibilityVariant = (
    cred?: string,
  ): "success" | "warning" | "critical" | "default" => {
    if (cred === "high") return "success";
    if (cred === "medium") return "warning";
    if (cred === "low" || cred === "very_low") return "critical";
    return "default";
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="External Source" />

      {node.url && (
        <div>
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
          >
            {node.url}
          </a>
        </div>
      )}

      <div className="space-y-1">
        {node.urlStatus && (
          <PropertyRow label="URL Status">
            <StatusBadge
              status={node.urlStatus}
              variant={getUrlStatusVariant(node.urlStatus)}
            />
          </PropertyRow>
        )}
        {node.domainCredibility && (
          <PropertyRow label="Domain Credibility">
            <StatusBadge
              status={node.domainCredibility}
              variant={getCredibilityVariant(node.domainCredibility)}
            />
          </PropertyRow>
        )}
        {node.snapshotDate && (
          <PropertyRow
            label="Snapshot Date"
            value={new Date(node.snapshotDate).toLocaleDateString()}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Stakeholder View Panel
 * Shows role, view status, overruled reason, incorporated_into
 */
function StakeholderViewPanel({
  node,
  onNavigate,
}: {
  node: GraphNode;
  onNavigate?: (nodeId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Stakeholder View" />

      {node.stakeholder && (
        <div className="text-lg font-medium text-gray-900 dark:text-white">
          {node.stakeholder}
        </div>
      )}

      <div className="space-y-1">
        {node.stakeholderRole && (
          <PropertyRow
            label="Role"
            value={node.stakeholderRole.replace(/_/g, " ")}
          />
        )}
        {node.viewStatus && (
          <PropertyRow label="Status">
            <StatusBadge
              status={node.viewStatus}
              variant={
                node.viewStatus === "adopted"
                  ? "success"
                  : node.viewStatus === "overruled"
                    ? "critical"
                    : "default"
              }
            />
          </PropertyRow>
        )}
        {node.overruledReason && (
          <PropertyRow label="Overruled Reason" value={node.overruledReason} />
        )}
        {node.incorporatedInto && (
          <PropertyRow label="Incorporated Into">
            <button
              onClick={() => onNavigate?.(node.incorporatedInto!)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {node.incorporatedInto}
            </button>
          </PropertyRow>
        )}
      </div>
    </div>
  );
}

/**
 * Placeholder Panel
 * Shows research query, partial info, existence status
 */
function PlaceholderPanel({ node }: { node: GraphNode }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Placeholder" />

      {node.placeholderFor && (
        <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Placeholder for:
          </span>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {node.placeholderFor}
          </p>
        </div>
      )}

      <div className="space-y-1">
        {node.researchQuery && (
          <PropertyRow label="Research Query" value={node.researchQuery} />
        )}
        {node.existenceConfirmed !== undefined && (
          <PropertyRow label="Existence">
            <StatusBadge
              status={node.existenceConfirmed ? "Confirmed" : "Unconfirmed"}
              variant={node.existenceConfirmed ? "success" : "default"}
            />
          </PropertyRow>
        )}
      </div>

      {node.partialInfo && node.partialInfo.length > 0 && (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            Partial Information
          </span>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            {node.partialInfo.map((info, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                <span>{info}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Meta Panel
 * Shows meta type, about reference, resolved status
 */
function MetaPanel({
  node,
  onNavigate,
}: {
  node: GraphNode;
  onNavigate?: (nodeId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Meta Block" />

      <div className="space-y-1">
        {node.metaType && (
          <PropertyRow
            label="Meta Type"
            value={node.metaType.replace(/_/g, " ")}
          />
        )}
        {node.about && (
          <PropertyRow label="About">
            <button
              onClick={() => onNavigate?.(node.about!)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {node.about}
            </button>
          </PropertyRow>
        )}
        {node.resolved !== undefined && (
          <PropertyRow label="Resolved">
            <StatusBadge
              status={node.resolved ? "Yes" : "No"}
              variant={node.resolved ? "success" : "warning"}
            />
          </PropertyRow>
        )}
      </div>
    </div>
  );
}

/**
 * Decision Panel
 * Shows topic, decided option, rationale, decision status
 */
function DecisionPanel({
  node,
  onNavigate,
}: {
  node: GraphNode;
  onNavigate?: (nodeId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Decision" />

      {node.topic && (
        <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Topic:
          </span>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {node.topic}
          </p>
        </div>
      )}

      <div className="space-y-1">
        {node.status && (
          <PropertyRow label="Status">
            <StatusBadge
              status={node.status}
              variant={node.status === "validated" ? "success" : "default"}
            />
          </PropertyRow>
        )}
        {node.decidedOption && (
          <PropertyRow label="Decided Option">
            <button
              onClick={() => onNavigate?.(node.decidedOption!)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {node.decidedOption}
            </button>
          </PropertyRow>
        )}
        {node.decisionRationale && (
          <div className="pt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Rationale
            </span>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {node.decisionRationale}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Option Panel
 * Shows selection status, alternatives, parent decision link
 */
function OptionPanel({
  node,
  onNavigate,
}: {
  node: GraphNode;
  onNavigate?: (nodeId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Option" />

      <div className="space-y-1">
        {node.selectionStatus && (
          <PropertyRow label="Status">
            <StatusBadge
              status={node.selectionStatus}
              variant={
                node.selectionStatus === "selected"
                  ? "success"
                  : node.selectionStatus === "rejected"
                    ? "critical"
                    : "default"
              }
            />
          </PropertyRow>
        )}
        {node.decision && (
          <PropertyRow label="Decision">
            <button
              onClick={() => onNavigate?.(node.decision!)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {node.decision}
            </button>
          </PropertyRow>
        )}
      </div>

      {node.alternativeTo && node.alternativeTo.length > 0 && (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            {node.alternativeTo.length} alternatives
          </span>
          <div className="flex flex-wrap gap-1">
            {node.alternativeTo.map((alt) => (
              <button
                key={alt}
                onClick={() => onNavigate?.(alt)}
                className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {alt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Topic Panel
 * Shows decided view, decision date, rationale, stakeholder views list
 */
function TopicPanel({
  node,
  onNavigate,
}: {
  node: GraphNode;
  onNavigate?: (nodeId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Topic" />

      <div className="space-y-1">
        {node.status && (
          <PropertyRow label="Status">
            <StatusBadge
              status={node.status}
              variant={node.status === "validated" ? "success" : "default"}
            />
          </PropertyRow>
        )}
        {node.decidedView && (
          <PropertyRow label="Decided View">
            <button
              onClick={() => onNavigate?.(node.decidedView!)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {node.decidedView}
            </button>
          </PropertyRow>
        )}
        {node.decisionDate && (
          <PropertyRow
            label="Decision Date"
            value={new Date(node.decisionDate).toLocaleDateString()}
          />
        )}
        {node.topicRationale && (
          <div className="pt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Rationale
            </span>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {node.topicRationale}
            </p>
          </div>
        )}
      </div>

      {node.stakeholderViews && node.stakeholderViews.length > 0 && (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            Stakeholder Views ({node.stakeholderViews.length})
          </span>
          <div className="space-y-1">
            {node.stakeholderViews.map((viewId) => (
              <button
                key={viewId}
                onClick={() => onNavigate?.(viewId)}
                className="w-full text-left text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {viewId}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Synthesis Panel
 * Shows synthesized blocks list, cluster theme, regenerate action
 */
function SynthesisPanel({
  node,
  onNavigate,
  onRegenerate,
}: {
  node: GraphNode;
  onNavigate?: (nodeId: string) => void;
  onRegenerate?: () => void;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Synthesis" />

      {node.clusterTheme && (
        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <span className="text-xs text-purple-600 dark:text-purple-400">
            Cluster Theme:
          </span>
          <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
            {node.clusterTheme}
          </p>
        </div>
      )}

      {node.synthesizes && node.synthesizes.length > 0 && (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            {node.synthesizes.length} blocks synthesized
          </span>
          <div className="flex flex-wrap gap-1">
            {node.synthesizes.map((blockId) => (
              <button
                key={blockId}
                onClick={() => onNavigate?.(blockId)}
                className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                {blockId}
              </button>
            ))}
          </div>
        </div>
      )}

      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="w-full px-3 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
        >
          Regenerate Synthesis
        </button>
      )}
    </div>
  );
}

/**
 * Pattern Panel
 * Shows instances list, portfolio tag, scope (global/idea)
 */
function PatternPanel({ node }: { node: GraphNode }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Pattern" />

      <div className="space-y-1">
        {node.scope && (
          <PropertyRow label="Scope">
            <StatusBadge
              status={node.scope}
              variant={node.scope === "global" ? "success" : "default"}
            />
          </PropertyRow>
        )}
        {node.portfolioTag && (
          <PropertyRow label="Portfolio Tag" value={node.portfolioTag} />
        )}
        {node.instanceOf && (
          <PropertyRow label="Instance Of" value={node.instanceOf} />
        )}
      </div>

      {node.sharedWith && node.sharedWith.length > 0 && (
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
            Shared with ideas
          </span>
          <div className="flex flex-wrap gap-1">
            {node.sharedWith.map((ideaId) => (
              <span
                key={ideaId}
                className="text-xs px-2 py-0.5 bg-pink-100 dark:bg-pink-900/30 rounded text-pink-600 dark:text-pink-400"
              >
                {ideaId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cycle Panel
 * Shows cycle information when node is part of a cycle
 */
function CyclePanel({ node }: { node: GraphNode }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Circular Dependency" />

      {node.cycleId && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-1">
            <svg
              className="w-4 h-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              Part of circular dependency
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {node.cycleType && (
          <PropertyRow label="Cycle Type">
            <StatusBadge
              status={node.cycleType}
              variant={node.cycleType === "blocking" ? "critical" : "warning"}
            />
          </PropertyRow>
        )}
        {node.cyclePosition !== undefined && (
          <PropertyRow
            label="Position in Cycle"
            value={`#${node.cyclePosition + 1}`}
          />
        )}
        {node.breakStrategy && (
          <PropertyRow label="Break Strategy" value={node.breakStrategy} />
        )}
        {node.breakPoint && (
          <PropertyRow label="Suggested Break Point" value={node.breakPoint} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * BlockTypeInspector Component
 * Renders the appropriate panel based on block type
 */
export function BlockTypeInspector({
  node,
  onRecalculate,
  onNavigate,
  onRegenerate,
  className = "",
}: BlockTypeInspectorProps) {
  // Get block-type specific panel
  const renderPanel = () => {
    switch (node.blockType) {
      case "assumption":
        return <AssumptionPanel node={node} onNavigate={onNavigate} />;
      case "derived":
        return <DerivedPanel node={node} onRecalculate={onRecalculate} />;
      case "action":
        return <ActionPanel node={node} />;
      case "external":
        return <ExternalPanel node={node} />;
      case "stakeholder_view":
        return <StakeholderViewPanel node={node} onNavigate={onNavigate} />;
      case "placeholder":
        return <PlaceholderPanel node={node} />;
      case "meta":
        return <MetaPanel node={node} onNavigate={onNavigate} />;
      case "decision":
        return <DecisionPanel node={node} onNavigate={onNavigate} />;
      case "option":
        return <OptionPanel node={node} onNavigate={onNavigate} />;
      case "topic":
        return <TopicPanel node={node} onNavigate={onNavigate} />;
      case "synthesis":
        return (
          <SynthesisPanel
            node={node}
            onNavigate={onNavigate}
            onRegenerate={onRegenerate}
          />
        );
      case "pattern":
        return <PatternPanel node={node} />;
      case "cycle":
        return <CyclePanel node={node} />;
      default:
        return null;
    }
  };

  // Check if node is part of a cycle (show cycle info regardless of block type)
  const showCycleInfo = node.cycleId && node.blockType !== "cycle";

  const panel = renderPanel();

  // If no specialized panel and no cycle info, show nothing
  if (!panel && !showCycleInfo) {
    return null;
  }

  return (
    <div
      className={`space-y-4 ${className}`}
      data-testid="block-type-inspector"
    >
      {/* Block type header */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{
            backgroundColor: `${nodeColors[node.blockType]}20`,
            color: nodeColors[node.blockType],
          }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <rect x="4" y="4" width="12" height="12" rx="2" />
          </svg>
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
          {node.blockType.replace(/_/g, " ")} Block
        </span>
      </div>

      {/* Specialized panel */}
      {panel}

      {/* Cycle info (shown for any block type that's in a cycle) */}
      {showCycleInfo && <CyclePanel node={node} />}
    </div>
  );
}

export default BlockTypeInspector;
