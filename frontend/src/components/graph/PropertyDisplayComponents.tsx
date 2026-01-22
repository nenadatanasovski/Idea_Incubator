/**
 * PropertyDisplayComponents
 * React components for displaying range/bounds and context-qualified properties
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.5, T7.6
 */

import type {
  RangeProperty,
  ContextQualifiedProperty,
} from "./utils/propertyDisplay";
import { formatNumber } from "./utils/propertyDisplay";

// ============================================================================
// Range Property Display (T7.5)
// ============================================================================

export interface RangePropertyDisplayProps {
  property: RangeProperty;
  className?: string;
}

/**
 * RangePropertyDisplay Component
 * Visualizes a property with min/max/estimate values as a range
 */
export function RangePropertyDisplay({
  property,
  className = "",
}: RangePropertyDisplayProps) {
  const { label, min, max, estimate, isHighUncertainty, uncertaintyRatio } =
    property;

  // Calculate positions for the range visualization
  const rangeMin = min ?? 0;
  const rangeMax = max ?? (estimate ? estimate * 2 : 100);
  const range = rangeMax - rangeMin;

  const estimatePosition =
    estimate !== undefined ? ((estimate - rangeMin) / range) * 100 : null;

  return (
    <div
      className={`p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg ${className}`}
      data-testid="range-property"
    >
      {/* Header with label and uncertainty warning */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
          {label}
        </span>
        {isHighUncertainty && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
            <svg
              className="w-3 h-3"
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
            High uncertainty
            {uncertaintyRatio && ` (${uncertaintyRatio.toFixed(1)}×)`}
          </span>
        )}
      </div>

      {/* Range visualization */}
      <div className="relative h-8 mb-2">
        {/* Background bar */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />

        {/* Range bar (min to max) */}
        {min !== undefined && max !== undefined && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-2 bg-blue-200 dark:bg-blue-800 rounded-full"
            style={{
              left: `${((min - rangeMin) / range) * 100}%`,
              width: `${((max - min) / range) * 100}%`,
            }}
          />
        )}

        {/* Estimate marker */}
        {estimatePosition !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
            style={{ left: `calc(${estimatePosition}% - 6px)` }}
          />
        )}

        {/* Min marker */}
        {min !== undefined && (
          <div
            className="absolute bottom-0 w-px h-3 bg-gray-400 dark:bg-gray-500"
            style={{ left: `${((min - rangeMin) / range) * 100}%` }}
          />
        )}

        {/* Max marker */}
        {max !== undefined && (
          <div
            className="absolute bottom-0 w-px h-3 bg-gray-400 dark:bg-gray-500"
            style={{ left: `${((max - rangeMin) / range) * 100}%` }}
          />
        )}
      </div>

      {/* Value labels */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        {min !== undefined && <span>Min: {formatNumber(min)}</span>}
        {estimate !== undefined && (
          <span className="font-medium text-blue-600 dark:text-blue-400">
            Est: {formatNumber(estimate)}
          </span>
        )}
        {max !== undefined && <span>Max: {formatNumber(max)}</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Context-Qualified Property Display (T7.6)
// ============================================================================

export interface ContextQualifiedPropertyDisplayProps {
  property: ContextQualifiedProperty;
  className?: string;
}

/**
 * ContextQualifiedPropertyDisplay Component
 * Displays a property that varies by context (e.g., price by region)
 */
export function ContextQualifiedPropertyDisplay({
  property,
  className = "",
}: ContextQualifiedPropertyDisplayProps) {
  const { label, variesBy, contexts, defaultValue } = property;

  // Convert Map to array for rendering
  const contextEntries = Array.from(contexts.entries());

  return (
    <div
      className={`p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg ${className}`}
      data-testid="context-qualified-property"
    >
      {/* Header with label and varies_by indicator */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
          {label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          varies by {variesBy}
        </span>
      </div>

      {/* Default value if present */}
      {defaultValue !== undefined && (
        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
          <span className="text-gray-500 dark:text-gray-400">Default: </span>
          <span className="font-medium text-blue-700 dark:text-blue-300">
            {typeof defaultValue === "number"
              ? formatNumber(defaultValue)
              : String(defaultValue)}
          </span>
        </div>
      )}

      {/* Context values */}
      <div className="space-y-1">
        {contextEntries.map(([context, value]) => (
          <div
            key={context}
            className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50"
          >
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {context}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {typeof value === "number" ? formatNumber(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Combined Properties Section
// ============================================================================

export interface SpecialPropertiesSectionProps {
  rangeProperties: RangeProperty[];
  contextQualifiedProperties: ContextQualifiedProperty[];
  className?: string;
}

/**
 * SpecialPropertiesSection Component
 * Renders all special property types in a unified section
 */
export function SpecialPropertiesSection({
  rangeProperties,
  contextQualifiedProperties,
  className = "",
}: SpecialPropertiesSectionProps) {
  const hasSpecialProperties =
    rangeProperties.length > 0 || contextQualifiedProperties.length > 0;

  if (!hasSpecialProperties) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="special-properties">
      {/* Range Properties */}
      {rangeProperties.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            Range Values
          </h4>
          {rangeProperties.map((prop) => (
            <RangePropertyDisplay key={prop.key} property={prop} />
          ))}
        </div>
      )}

      {/* Context-Qualified Properties */}
      {contextQualifiedProperties.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
            Context-Specific Values
          </h4>
          {contextQualifiedProperties.map((prop) => (
            <ContextQualifiedPropertyDisplay key={prop.key} property={prop} />
          ))}
        </div>
      )}
    </div>
  );
}

export default {
  RangePropertyDisplay,
  ContextQualifiedPropertyDisplay,
  SpecialPropertiesSection,
};
