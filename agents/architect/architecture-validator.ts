/**
 * Architecture Validator
 *
 * Validates architecture documents for anti-patterns, design issues, and best practices.
 * Detects issues in API design, database design, security, and component structure.
 */

import { ArchitectureDoc, RESTEndpoint } from "./types.js";

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = "error" | "warning" | "info";

/**
 * Validation issue with severity and remediation suggestions
 */
export interface ValidationIssue {
  id: string;
  type: string;
  severity: ValidationSeverity;
  component?: string;
  description: string;
  remediation: string;
  references?: string[];
}

/**
 * Validation report with all issues found
 */
export interface ValidationReport {
  projectName: string;
  generatedAt: Date;
  isValid: boolean;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
  summary: string;
}

/**
 * Architecture Validator
 *
 * Validates architecture documents for common anti-patterns and best practices.
 */
export class ArchitectureValidator {
  /**
   * Validate an architecture document
   */
  validate(architecture: ArchitectureDoc): ValidationReport {
    const issues: ValidationIssue[] = [];

    // Run all validators
    issues.push(...this.validateComponentStructure(architecture));
    issues.push(...this.validateCircularDependencies(architecture));
    issues.push(...this.validateAPIDesign(architecture));
    issues.push(...this.validateDatabaseDesign(architecture));
    issues.push(...this.validateSecurityConcerns(architecture));
    issues.push(...this.validateCachingStrategy(architecture));

    // Count by severity
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;

    const report: ValidationReport = {
      projectName: architecture.projectName,
      generatedAt: new Date(),
      isValid: errorCount === 0,
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount,
      issues,
      summary: this.generateSummary(errorCount, warningCount, infoCount),
    };

    return report;
  }

  /**
   * Validate component structure for god components and clarity
   */
  private validateComponentStructure(
    architecture: ArchitectureDoc,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const component of architecture.components) {
      // Check for god components (too many responsibilities)
      if (component.responsibilities.length > 8) {
        issues.push({
          id: `god-component-${component.id}`,
          type: "god-component",
          severity: "warning",
          component: component.name,
          description: `Component "${component.name}" has ${component.responsibilities.length} responsibilities, suggesting it may violate Single Responsibility Principle`,
          remediation: `Break down "${component.name}" into smaller, more focused components each with 3-5 responsibilities`,
          references: ["Single Responsibility Principle", "Clean Architecture"],
        });
      }

      // Check for missing description
      if (!component.description || component.description.length < 10) {
        issues.push({
          id: `missing-description-${component.id}`,
          type: "missing-description",
          severity: "info",
          component: component.name,
          description: `Component "${component.name}" has no meaningful description`,
          remediation: `Add a clear, detailed description of the component's purpose and responsibilities`,
        });
      }

      // Check for missing design patterns
      if (component.designPatterns.length === 0) {
        issues.push({
          id: `no-design-patterns-${component.id}`,
          type: "missing-design-patterns",
          severity: "info",
          component: component.name,
          description: `Component "${component.name}" does not specify any design patterns`,
          remediation: `Document the design patterns used (e.g., MVC, Factory, Observer) to improve understanding`,
        });
      }
    }

    return issues;
  }

  /**
   * Validate for circular dependencies between components
   */
  private validateCircularDependencies(
    architecture: ArchitectureDoc,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const adjacencyMap = new Map<string, Set<string>>();

    // Build adjacency map
    for (const component of architecture.components) {
      adjacencyMap.set(component.id, new Set(component.dependencies));
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string, path: string[] = []): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyMap.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, path)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          issues.push({
            id: `circular-dependency-${nodeId}-${neighbor}`,
            type: "circular-dependency",
            severity: "error",
            component: nodeId,
            description: `Circular dependency detected: ${path.join(" → ")} → ${neighbor}`,
            remediation: `Refactor to break the circular dependency. Consider introducing an intermediary component or using dependency injection`,
            references: ["Acyclic Dependencies Principle"],
          });
          return true;
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    // Check all components
    for (const componentId of adjacencyMap.keys()) {
      if (!visited.has(componentId)) {
        hasCycle(componentId);
      }
    }

    return issues;
  }

  /**
   * Validate API design for consistency and best practices
   */
  private validateAPIDesign(architecture: ArchitectureDoc): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const api of architecture.apiContracts) {
      // Check for missing authentication
      if (!api.authentication) {
        issues.push({
          id: `missing-auth-${api.id}`,
          type: "missing-authentication",
          severity: "error",
          component: api.name,
          description: `API "${api.name}" has no authentication specification`,
          remediation: `Define authentication mechanism (JWT, OAuth2, API Key) and apply it to endpoints`,
          references: ["OWASP API Security", "REST Security Best Practices"],
        });
      }

      // Check for missing rate limiting
      if (!api.rateLimit) {
        issues.push({
          id: `missing-rate-limit-${api.id}`,
          type: "missing-rate-limiting",
          severity: "warning",
          component: api.name,
          description: `API "${api.name}" has no rate limiting specification`,
          remediation: `Implement rate limiting (e.g., 1000 requests per hour) to prevent abuse`,
          references: ["API Security", "DDoS Prevention"],
        });
      }

      if (api.endpoints) {
        // Validate REST endpoints
        issues.push(
          ...this.validateRESTEndpoints(api.id, api.name, api.endpoints),
        );
      }
    }

    return issues;
  }

  /**
   * Validate REST endpoint design
   */
  private validateRESTEndpoints(
    apiId: string,
    apiName: string,
    endpoints: RESTEndpoint[],
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const usedPaths = new Set<string>();

    for (const endpoint of endpoints) {
      // Check for consistent naming (should use kebab-case or lowercase)
      const pathParts = endpoint.path.split("/");
      for (const part of pathParts) {
        if (part && /[A-Z]/.test(part)) {
          issues.push({
            id: `inconsistent-naming-${apiId}-${endpoint.path}`,
            type: "inconsistent-naming",
            severity: "warning",
            component: apiName,
            description: `Endpoint path "${endpoint.path}" uses camelCase instead of kebab-case convention`,
            remediation: `Use kebab-case for path segments (e.g., /user-profiles instead of /userProfiles)`,
            references: ["REST API Best Practices", "RFC 3986"],
          });
          break;
        }
      }

      // Check for missing pagination on list endpoints
      if (
        (endpoint.method === "GET" && endpoint.path.includes("list")) ||
        endpoint.path.endsWith("s")
      ) {
        const hasPaginationParam = endpoint.parameters?.some(
          (p) =>
            p.name.toLowerCase().includes("limit") ||
            p.name.toLowerCase().includes("offset") ||
            p.name.toLowerCase().includes("page"),
        );
        if (!hasPaginationParam) {
          issues.push({
            id: `missing-pagination-${apiId}-${endpoint.path}`,
            type: "missing-pagination",
            severity: "warning",
            component: apiName,
            description: `Endpoint "${endpoint.path}" appears to be a list endpoint but lacks pagination parameters`,
            remediation: `Add pagination parameters (limit/offset or page/size) to prevent large response bodies`,
            references: ["REST API Best Practices"],
          });
        }
      }

      // Check for missing response documentation
      if (Object.keys(endpoint.responses).length === 0) {
        issues.push({
          id: `missing-responses-${apiId}-${endpoint.path}`,
          type: "missing-response-spec",
          severity: "info",
          component: apiName,
          description: `Endpoint "${endpoint.path}" has no response specifications`,
          remediation: `Document all possible response codes (200, 400, 401, 500) and their schemas`,
        });
      }

      // Track duplicate paths
      if (usedPaths.has(endpoint.path)) {
        issues.push({
          id: `duplicate-endpoint-${apiId}-${endpoint.path}`,
          type: "duplicate-endpoint",
          severity: "error",
          component: apiName,
          description: `Duplicate endpoint path: "${endpoint.path}"`,
          remediation: `Remove or consolidate duplicate endpoint definitions`,
        });
      }
      usedPaths.add(endpoint.path);
    }

    return issues;
  }

  /**
   * Validate database design for performance and integrity
   */
  private validateDatabaseDesign(
    architecture: ArchitectureDoc,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const schema = architecture.databaseSchema;

    if (!schema.tables) {
      return issues;
    }

    for (const table of schema.tables) {
      // Check for missing primary key
      if (!table.primaryKey || table.primaryKey.length === 0) {
        issues.push({
          id: `missing-pk-${table.name}`,
          type: "missing-primary-key",
          severity: "error",
          component: table.name,
          description: `Table "${table.name}" has no primary key defined`,
          remediation: `Define a primary key (typically an id column) to uniquely identify rows`,
          references: ["Database Design Best Practices"],
        });
      }

      // Check for missing indexes on foreign keys
      const hasForeignKeys = table.columns.some(
        (c) => c.name.endsWith("_id") || c.name.includes("id_"),
      );
      if (hasForeignKeys) {
        const indexedColumns = new Set(
          (schema.indexes || [])
            .filter((idx) => idx.table === table.name)
            .flatMap((idx) => idx.columns),
        );

        for (const column of table.columns) {
          if (
            (column.name.endsWith("_id") || column.name.includes("id_")) &&
            !indexedColumns.has(column.name)
          ) {
            issues.push({
              id: `missing-index-${table.name}-${column.name}`,
              type: "missing-index",
              severity: "warning",
              component: table.name,
              description: `Foreign key column "${table.name}.${column.name}" has no index, risking N+1 query problems`,
              remediation: `Add an index on the foreign key column to improve join performance`,
              references: ["Database Performance", "N+1 Query Prevention"],
            });
          }
        }
      }

      // Check for soft delete strategy
      const hasSoftDeleteColumn = table.columns.some(
        (c) => c.name === "deleted_at" || c.name === "is_deleted",
      );
      if (!hasSoftDeleteColumn && table.columns.length > 2) {
        issues.push({
          id: `no-soft-delete-${table.name}`,
          type: "missing-soft-delete",
          severity: "info",
          component: table.name,
          description: `Table "${table.name}" has no soft delete column (deleted_at or is_deleted)`,
          remediation: `Add a soft delete column to preserve historical data and maintain referential integrity`,
          references: ["Data Preservation Patterns"],
        });
      }

      // Check for audit columns
      const hasAuditColumns = table.columns.some(
        (c) => c.name === "created_at" || c.name === "updated_at",
      );
      if (!hasAuditColumns) {
        issues.push({
          id: `missing-audit-columns-${table.name}`,
          type: "missing-audit-columns",
          severity: "info",
          component: table.name,
          description: `Table "${table.name}" lacks audit columns (created_at, updated_at)`,
          remediation: `Add created_at and updated_at columns for tracking record lifecycle`,
        });
      }
    }

    return issues;
  }

  /**
   * Validate security concerns
   */
  private validateSecurityConcerns(
    architecture: ArchitectureDoc,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for authentication across components
    const hasAuthentication = architecture.apiContracts.some(
      (api) => api.authentication,
    );
    if (!hasAuthentication && architecture.apiContracts.length > 0) {
      issues.push({
        id: "no-auth-strategy",
        type: "missing-authentication-strategy",
        severity: "error",
        description: "No authentication strategy defined for any API",
        remediation:
          "Define a centralized authentication mechanism (JWT, OAuth2, etc.) and apply it consistently across all APIs",
        references: ["OWASP Top 10", "API Security"],
      });
    }

    // Check quality attributes for security
    const hasSecurityQA = architecture.qualityAttributes.some(
      (qa) => qa.category === "security",
    );
    if (!hasSecurityQA) {
      issues.push({
        id: "missing-security-qa",
        type: "missing-security-requirements",
        severity: "warning",
        description: "No explicit security quality attributes defined",
        remediation:
          "Add security quality attributes such as encryption, access control, and audit logging requirements",
        references: ["Security Architecture"],
      });
    }

    // Check for exposed secrets in documentation
    // Look for actual hardcoded values, not just mentions in architecture patterns
    const sensitivePatterns = [
      /:\s*"(password|secret|apikey|credential)"\s*:\s*"[^"]+"/i,
      /aws_access_key_id|aws_secret_access_key/i,
      /db_password\s*[:=]/i,
    ];

    const allText = JSON.stringify(architecture);
    for (const pattern of sensitivePatterns) {
      if (pattern.test(allText)) {
        issues.push({
          id: "exposed-secrets",
          type: "exposed-credentials",
          severity: "error",
          description:
            "Architecture documentation may contain exposed secrets or sensitive credentials",
          remediation:
            "Remove all hardcoded secrets. Use environment variables or secret management systems (AWS Secrets Manager, HashiCorp Vault)",
          references: ["OWASP Secrets Management"],
        });
        break;
      }
    }

    return issues;
  }

  /**
   * Validate caching strategy
   */
  private validateCachingStrategy(
    architecture: ArchitectureDoc,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if any components mention caching
    const mentionsCaching = architecture.components.some(
      (c) =>
        c.designPatterns.some((p) => p.toLowerCase().includes("cache")) ||
        c.description.toLowerCase().includes("cache"),
    );

    // Check quality attributes for performance/caching
    const hasPerformanceQA = architecture.qualityAttributes.some(
      (qa) =>
        qa.category === "performance" ||
        qa.name.toLowerCase().includes("cache"),
    );

    if (!mentionsCaching && !hasPerformanceQA) {
      issues.push({
        id: "no-caching-strategy",
        type: "missing-caching-strategy",
        severity: "warning",
        description: "No caching strategy identified in the architecture",
        remediation:
          "Define a caching strategy (application-level, CDN, or database query caching) to improve performance",
        references: ["Caching Strategies", "Performance Optimization"],
      });
    }

    return issues;
  }

  /**
   * Generate a summary of validation results
   */
  private generateSummary(
    errorCount: number,
    warningCount: number,
    infoCount: number,
  ): string {
    const parts: string[] = [];

    if (errorCount === 0 && warningCount === 0 && infoCount === 0) {
      return "Architecture is valid with no issues detected.";
    }

    if (errorCount > 0) {
      parts.push(`${errorCount} blocking error${errorCount !== 1 ? "s" : ""}`);
    }

    if (warningCount > 0) {
      parts.push(`${warningCount} warning${warningCount !== 1 ? "s" : ""}`);
    }

    if (infoCount > 0) {
      parts.push(`${infoCount} info message${infoCount !== 1 ? "s" : ""}`);
    }

    return `Found ${parts.join(", ")}. ${errorCount > 0 ? "Address blocking errors before deployment." : "Address warnings to improve architecture quality."}`;
  }
}

export default ArchitectureValidator;
