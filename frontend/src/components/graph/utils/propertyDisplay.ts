/**
 * Property Display Utilities
 * Handles special property formats like range/bounds and context-qualified values
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.5, T7.6
 */

// ============================================================================
// Types
// ============================================================================

export interface RangeProperty {
  key: string;
  label: string;
  min?: number;
  max?: number;
  estimate?: number;
  isHighUncertainty: boolean;
  uncertaintyRatio: number | null;
}

export interface ContextQualifiedProperty {
  key: string;
  label: string;
  variesBy: string;
  contexts: Map<string, unknown>;
  defaultValue?: unknown;
}

export interface ParsedProperties {
  regularProperties: Record<string, unknown>;
  rangeProperties: RangeProperty[];
  contextQualifiedProperties: ContextQualifiedProperty[];
}

// ============================================================================
// Range/Bounds Property Detection (T7.5)
// ============================================================================

/**
 * Property suffixes that indicate range/bounds values
 */
const RANGE_SUFFIXES = ["_min", "_max", "_estimate"] as const;

/**
 * High uncertainty threshold (max/min ratio)
 */
const HIGH_UNCERTAINTY_THRESHOLD = 3;

/**
 * Detect if a property key has a range suffix
 */
function hasRangeSuffix(key: string): boolean {
  return RANGE_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

/**
 * Extract base key from a ranged property key
 */
function getBaseKey(key: string): string {
  for (const suffix of RANGE_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return key;
}

/**
 * Get the suffix type of a ranged property key
 */
function getSuffixType(key: string): "min" | "max" | "estimate" | null {
  if (key.endsWith("_min")) return "min";
  if (key.endsWith("_max")) return "max";
  if (key.endsWith("_estimate")) return "estimate";
  return null;
}

/**
 * Parse range properties from a properties object
 * Groups related _min, _max, _estimate properties together
 */
export function parseRangeProperties(
  properties: Record<string, unknown>,
): RangeProperty[] {
  const rangeGroups = new Map<
    string,
    { min?: number; max?: number; estimate?: number }
  >();

  // Find all range-related properties
  for (const [key, value] of Object.entries(properties)) {
    if (!hasRangeSuffix(key)) continue;

    const baseKey = getBaseKey(key);
    const suffixType = getSuffixType(key);
    const numValue =
      typeof value === "number" ? value : parseFloat(String(value));

    if (isNaN(numValue)) continue;

    if (!rangeGroups.has(baseKey)) {
      rangeGroups.set(baseKey, {});
    }

    const group = rangeGroups.get(baseKey)!;
    if (suffixType === "min") group.min = numValue;
    if (suffixType === "max") group.max = numValue;
    if (suffixType === "estimate") group.estimate = numValue;
  }

  // Convert to RangeProperty array
  const result: RangeProperty[] = [];

  for (const [baseKey, values] of rangeGroups) {
    const { min, max, estimate } = values;

    // Calculate uncertainty ratio
    let uncertaintyRatio: number | null = null;
    if (min !== undefined && max !== undefined && min > 0) {
      uncertaintyRatio = max / min;
    }

    const isHighUncertainty =
      uncertaintyRatio !== null &&
      uncertaintyRatio > HIGH_UNCERTAINTY_THRESHOLD;

    result.push({
      key: baseKey,
      label: baseKey.replace(/_/g, " "),
      min,
      max,
      estimate,
      isHighUncertainty,
      uncertaintyRatio,
    });
  }

  return result;
}

// ============================================================================
// Context-Qualified Property Detection (T7.6)
// ============================================================================

/**
 * Context separator in property keys
 * Example: price__us, price__eu, price__asia
 */
const CONTEXT_SEPARATOR = "__";

/**
 * Detect if a property key has context qualification
 */
function hasContextQualification(key: string): boolean {
  return key.includes(CONTEXT_SEPARATOR);
}

/**
 * Extract base key and context from a context-qualified property key
 */
function parseContextKey(
  key: string,
): { baseKey: string; context: string } | null {
  const parts = key.split(CONTEXT_SEPARATOR);
  if (parts.length !== 2) return null;

  return {
    baseKey: parts[0],
    context: parts[1],
  };
}

/**
 * Parse context-qualified properties from a properties object
 * Groups properties by base key with different context values
 */
export function parseContextQualifiedProperties(
  properties: Record<string, unknown>,
): ContextQualifiedProperty[] {
  const contextGroups = new Map<string, Map<string, unknown>>();
  const variesByMap = new Map<string, string>();

  // Find the varies_by dimension if specified
  for (const [key, value] of Object.entries(properties)) {
    if (key === "varies_by" && typeof value === "string") {
      // This indicates which dimension the values vary by
      // We'll store this for all detected context-qualified properties
      variesByMap.set("_default", value);
    }
    // Also check for property-specific varies_by (e.g., price_varies_by)
    if (key.endsWith("_varies_by") && typeof value === "string") {
      const baseKey = key.replace("_varies_by", "");
      variesByMap.set(baseKey, value);
    }
  }

  // Find all context-qualified properties
  for (const [key, value] of Object.entries(properties)) {
    if (!hasContextQualification(key)) continue;

    const parsed = parseContextKey(key);
    if (!parsed) continue;

    const { baseKey, context } = parsed;

    if (!contextGroups.has(baseKey)) {
      contextGroups.set(baseKey, new Map());
    }

    contextGroups.get(baseKey)!.set(context, value);
  }

  // Convert to ContextQualifiedProperty array
  const result: ContextQualifiedProperty[] = [];

  for (const [baseKey, contexts] of contextGroups) {
    // Get varies_by for this property or use default
    const variesBy =
      variesByMap.get(baseKey) || variesByMap.get("_default") || "context";

    // Get default value if it exists (property without context suffix)
    const defaultValue = properties[baseKey];

    result.push({
      key: baseKey,
      label: baseKey.replace(/_/g, " "),
      variesBy,
      contexts,
      defaultValue,
    });
  }

  return result;
}

// ============================================================================
// Main Parsing Function
// ============================================================================

/**
 * Parse all properties and categorize them
 */
export function parseProperties(
  properties: Record<string, unknown>,
): ParsedProperties {
  const rangeProperties = parseRangeProperties(properties);
  const contextQualifiedProperties =
    parseContextQualifiedProperties(properties);

  // Get keys that are part of range or context-qualified properties
  const specialKeys = new Set<string>();

  // Add range property keys
  for (const rp of rangeProperties) {
    specialKeys.add(`${rp.key}_min`);
    specialKeys.add(`${rp.key}_max`);
    specialKeys.add(`${rp.key}_estimate`);
  }

  // Add context-qualified property keys
  for (const cp of contextQualifiedProperties) {
    for (const context of cp.contexts.keys()) {
      specialKeys.add(`${cp.key}${CONTEXT_SEPARATOR}${context}`);
    }
    specialKeys.add(`${cp.key}_varies_by`);
  }

  // Also add general varies_by
  specialKeys.add("varies_by");

  // Filter regular properties (those not part of special groups)
  const regularProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!specialKeys.has(key)) {
      regularProperties[key] = value;
    }
  }

  return {
    regularProperties,
    rangeProperties,
    contextQualifiedProperties,
  };
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a number for display
 */
export function formatNumber(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format a range for display
 */
export function formatRange(range: RangeProperty): string {
  const parts: string[] = [];

  if (range.min !== undefined) {
    parts.push(`min: ${formatNumber(range.min)}`);
  }
  if (range.estimate !== undefined) {
    parts.push(`est: ${formatNumber(range.estimate)}`);
  }
  if (range.max !== undefined) {
    parts.push(`max: ${formatNumber(range.max)}`);
  }

  return parts.join(" | ");
}

/**
 * Format context-qualified values for display
 */
export function formatContextValues(
  property: ContextQualifiedProperty,
): string {
  const parts: string[] = [];

  for (const [context, value] of property.contexts) {
    const displayValue =
      typeof value === "number" ? formatNumber(value) : String(value);
    parts.push(`${context}: ${displayValue}`);
  }

  return parts.join(", ");
}

export default {
  parseRangeProperties,
  parseContextQualifiedProperties,
  parseProperties,
  formatNumber,
  formatRange,
  formatContextValues,
};
