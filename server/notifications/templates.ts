/**
 * Template Rendering for Notifications
 * Handles {{variable}} substitution with support for nested paths
 */

/**
 * Get nested value from object using dot notation path
 * e.g., getNestedValue({ user: { name: 'John' }}, 'user.name') => 'John'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((curr: unknown, key: string) => {
    if (curr && typeof curr === "object" && key in curr) {
      return (curr as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Render a template string by replacing {{variable}} placeholders with values from data
 * Supports nested paths like {{user.name}}
 * Missing variables are left as-is (not replaced)
 *
 * @param template - The template string with {{variable}} placeholders
 * @param data - The data object to pull values from
 * @returns The rendered string with placeholders replaced
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path);
    if (value !== undefined && value !== null) {
      return String(value);
    }
    // Return the original placeholder if value not found
    return match;
  });
}

/**
 * Escape HTML special characters for use in email templates
 * Prevents XSS in HTML email content
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

/**
 * Render template with HTML-escaped values
 * Safe for use in HTML email content
 */
export function renderHtmlTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path);
    if (value !== undefined && value !== null) {
      return escapeHtml(String(value));
    }
    return match;
  });
}

/**
 * Check if a template has all required variables defined
 * @returns Array of missing variable names
 */
export function getMissingVariables(
  template: string,
  data: Record<string, unknown>,
): string[] {
  const variables: string[] = [];
  const regex = /\{\{(\w+(?:\.\w+)*)\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const path = match[1];
    const value = getNestedValue(data, path);
    if (value === undefined || value === null) {
      variables.push(path);
    }
  }

  return variables;
}

/**
 * Extract all variable names from a template
 */
export function extractVariables(template: string): string[] {
  const variables: string[] = [];
  const regex = /\{\{(\w+(?:\.\w+)*)\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}
