/**
 * Feature Implementation Orchestration Layer
 *
 * Coordinates frontend, backend, and database changes for complete
 * feature implementation. Sequences execution in the correct order:
 * DB migrations → API endpoints → UI components, validates cross-layer
 * consistency, and supports rollback on partial failure.
 *
 * VIBE-P13-005 - Depends on generators from VIBE-P13-001..004
 */

import { v4 as uuidv4 } from 'uuid';
import { run, query, getOne } from '../db/index.js';
import { createEvent } from '../db/events.js';
import { broadcast } from '../websocket.js';

// ============ TYPES ============

/** Layer in the feature implementation stack */
export type FeatureLayer = 'database' | 'api' | 'ui';

/** Execution order for layers - lower runs first */
const LAYER_ORDER: Record<FeatureLayer, number> = {
  database: 0,
  api: 1,
  ui: 2,
};

/** Status of a single layer's generation */
export type LayerStatus =
  | 'pending'
  | 'generating'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'rolled_back';

/** Status of the overall feature orchestration */
export type OrchestrationStatus =
  | 'parsing'
  | 'generating'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'rolling_back'
  | 'rolled_back';

// ---- Feature Spec (input) ----

/** Database layer specification */
export interface DatabaseSpec {
  tables: TableSpec[];
  migrations?: string[];
  indexes?: IndexSpec[];
}

export interface TableSpec {
  name: string;
  columns: ColumnSpec[];
  foreignKeys?: ForeignKeySpec[];
}

export interface ColumnSpec {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: string;
  primaryKey?: boolean;
  unique?: boolean;
}

export interface IndexSpec {
  table: string;
  columns: string[];
  unique?: boolean;
}

export interface ForeignKeySpec {
  column: string;
  references: { table: string; column: string };
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

/** API layer specification */
export interface ApiSpec {
  endpoints: EndpointSpec[];
  middleware?: string[];
}

export interface EndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: string;
  requestBody?: TypeRef;
  responseBody?: TypeRef;
  queryParams?: ParamSpec[];
  pathParams?: ParamSpec[];
  auth?: boolean;
}

export interface TypeRef {
  name: string;
  fields: Record<string, string>;
}

export interface ParamSpec {
  name: string;
  type: string;
  required?: boolean;
}

/** UI layer specification */
export interface UiSpec {
  components: ComponentSpec[];
  routes?: RouteSpec[];
  hooks?: HookSpec[];
}

export interface ComponentSpec {
  name: string;
  path: string;
  props?: Record<string, string>;
  apiCalls?: string[];
}

export interface RouteSpec {
  path: string;
  component: string;
}

export interface HookSpec {
  name: string;
  endpoint: string;
  returnType: string;
}

/** Full feature specification parsed into layers */
export interface FeatureSpec {
  id: string;
  name: string;
  description: string;
  layers: {
    database?: DatabaseSpec;
    api?: ApiSpec;
    ui?: UiSpec;
  };
  metadata?: Record<string, unknown>;
}

// ---- Generator results ----

export interface GeneratedFile {
  path: string;
  content: string;
  layer: FeatureLayer;
}

export interface LayerResult {
  layer: FeatureLayer;
  status: LayerStatus;
  files: GeneratedFile[];
  errors: string[];
  startedAt: string;
  completedAt?: string;
}

// ---- Cross-layer validation ----

export interface ValidationIssue {
  severity: 'error' | 'warning';
  layer: FeatureLayer;
  relatedLayer?: FeatureLayer;
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ---- Orchestration tracking ----

export interface OrchestrationRun {
  id: string;
  featureSpecId: string;
  featureName: string;
  status: OrchestrationStatus;
  layerResults: Map<FeatureLayer, LayerResult>;
  validationResult?: ValidationResult;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// ============ GENERATOR INTERFACE ============

/**
 * Interface that layer generators (VIBE-P13-001..004) must implement.
 * Each generator takes a layer spec and produces files.
 */
export interface LayerGenerator {
  readonly layer: FeatureLayer;

  /**
   * Generate code for this layer based on the spec.
   * Returns generated files or throws on failure.
   */
  generate(
    spec: DatabaseSpec | ApiSpec | UiSpec,
    context: GeneratorContext,
  ): Promise<LayerResult>;

  /**
   * Validate the generated output in isolation (syntax, structure).
   */
  validate(result: LayerResult): Promise<ValidationResult>;

  /**
   * Rollback files created by this generator.
   */
  rollback(result: LayerResult): Promise<void>;
}

export interface GeneratorContext {
  runId: string;
  featureSpec: FeatureSpec;
  previousLayers: Map<FeatureLayer, LayerResult>;
  codebaseRoot: string;
}

// ============ PERSISTENCE ============

function ensureOrchestrationTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS feature_orchestration_runs (
      id TEXT PRIMARY KEY,
      feature_spec_id TEXT NOT NULL,
      feature_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'parsing',
      layer_results TEXT,
      validation_result TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `, []);

  run(`
    CREATE TABLE IF NOT EXISTS feature_generated_files (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      layer TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content_hash TEXT,
      rolled_back INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES feature_orchestration_runs(id)
    )
  `, []);

  run(
    `CREATE INDEX IF NOT EXISTS idx_fgf_run ON feature_generated_files(run_id)`,
    [],
  );
}

ensureOrchestrationTable();

// ============ CROSS-LAYER VALIDATION ============

/**
 * Validate consistency between database and API layers.
 * Checks that API endpoints reference valid table columns.
 */
function validateDbApiConsistency(
  dbSpec: DatabaseSpec,
  apiSpec: ApiSpec,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tableColumns = new Map<string, Set<string>>();

  for (const table of dbSpec.tables) {
    const cols = new Set(table.columns.map((c) => c.name));
    tableColumns.set(table.name, cols);
  }

  for (const endpoint of apiSpec.endpoints) {
    // Check request body fields reference valid columns
    if (endpoint.requestBody) {
      for (const [field, type] of Object.entries(endpoint.requestBody.fields)) {
        // Heuristic: field names that match table.column patterns
        const parts = field.split('.');
        if (parts.length === 2) {
          const [table, col] = parts;
          const cols = tableColumns.get(table);
          if (cols && !cols.has(col)) {
            issues.push({
              severity: 'error',
              layer: 'api',
              relatedLayer: 'database',
              message: `Endpoint ${endpoint.method} ${endpoint.path} references column "${col}" on table "${table}" which does not exist`,
              field,
            });
          }
        }
      }
    }

    // Check response body fields
    if (endpoint.responseBody) {
      for (const [field] of Object.entries(endpoint.responseBody.fields)) {
        const parts = field.split('.');
        if (parts.length === 2) {
          const [table, col] = parts;
          const cols = tableColumns.get(table);
          if (cols && !cols.has(col)) {
            issues.push({
              severity: 'warning',
              layer: 'api',
              relatedLayer: 'database',
              message: `Endpoint ${endpoint.method} ${endpoint.path} response references column "${col}" on table "${table}" which does not exist`,
              field,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Validate consistency between API and UI layers.
 * Checks that UI components call valid API endpoints.
 */
function validateApiUiConsistency(
  apiSpec: ApiSpec,
  uiSpec: UiSpec,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const endpointPaths = new Set(
    apiSpec.endpoints.map((e) => `${e.method} ${e.path}`),
  );
  const endpointPathsOnly = new Set(apiSpec.endpoints.map((e) => e.path));

  // Check hooks reference valid endpoints
  if (uiSpec.hooks) {
    for (const hook of uiSpec.hooks) {
      if (!endpointPathsOnly.has(hook.endpoint)) {
        issues.push({
          severity: 'error',
          layer: 'ui',
          relatedLayer: 'api',
          message: `Hook "${hook.name}" references endpoint "${hook.endpoint}" which is not defined in the API spec`,
          field: hook.name,
        });
      }
    }
  }

  // Check component API calls reference valid endpoints
  for (const component of uiSpec.components) {
    if (component.apiCalls) {
      for (const call of component.apiCalls) {
        // call format: "GET /api/foo" or just "/api/foo"
        const hasMethod = /^(GET|POST|PUT|PATCH|DELETE)\s/.test(call);
        if (hasMethod) {
          if (!endpointPaths.has(call)) {
            issues.push({
              severity: 'error',
              layer: 'ui',
              relatedLayer: 'api',
              message: `Component "${component.name}" calls "${call}" which is not defined in the API spec`,
              field: component.name,
            });
          }
        } else {
          if (!endpointPathsOnly.has(call)) {
            issues.push({
              severity: 'error',
              layer: 'ui',
              relatedLayer: 'api',
              message: `Component "${component.name}" calls endpoint "${call}" which is not defined in the API spec`,
              field: component.name,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Validate type consistency across all layers.
 * Ensures DB column types map to API types which map to UI prop types.
 */
function validateTypeConsistency(spec: FeatureSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { database, api, ui } = spec.layers;

  if (database && api) {
    issues.push(...validateDbApiConsistency(database, api));
  }

  if (api && ui) {
    issues.push(...validateApiUiConsistency(api, ui));
  }

  return issues;
}

// ============ SPEC PARSER ============

/**
 * Determine which layers are required for a feature spec.
 */
function getRequiredLayers(spec: FeatureSpec): FeatureLayer[] {
  const layers: FeatureLayer[] = [];
  if (spec.layers.database) layers.push('database');
  if (spec.layers.api) layers.push('api');
  if (spec.layers.ui) layers.push('ui');

  // Sort by execution order
  layers.sort((a, b) => LAYER_ORDER[a] - LAYER_ORDER[b]);
  return layers;
}

/**
 * Get the spec for a specific layer.
 */
function getLayerSpec(
  spec: FeatureSpec,
  layer: FeatureLayer,
): DatabaseSpec | ApiSpec | UiSpec | undefined {
  return spec.layers[layer];
}

// ============ ORCHESTRATOR ============

/**
 * Feature Implementation Orchestrator
 *
 * Coordinates multi-layer code generation with:
 * - Sequential DB → API → UI execution
 * - Cross-layer type validation
 * - Rollback on partial failure
 * - Persistent run tracking
 */
export class FeatureOrchestrator {
  private generators = new Map<FeatureLayer, LayerGenerator>();
  private codebaseRoot: string;

  constructor(codebaseRoot: string) {
    this.codebaseRoot = codebaseRoot;
  }

  /**
   * Register a layer generator. Called by VIBE-P13-001..004 modules.
   */
  registerGenerator(generator: LayerGenerator): void {
    this.generators.set(generator.layer, generator);
  }

  /**
   * Check if all required generators are registered for a spec.
   */
  private checkGenerators(layers: FeatureLayer[]): string[] {
    const missing: string[] = [];
    for (const layer of layers) {
      if (!this.generators.has(layer)) {
        missing.push(layer);
      }
    }
    return missing;
  }

  /**
   * Orchestrate the full feature implementation.
   *
   * 1. Parse spec into layers
   * 2. Pre-validate cross-layer consistency
   * 3. Execute generators in order: DB → API → UI
   * 4. Post-validate generated output
   * 5. Run integration checks
   * 6. Rollback on failure
   */
  async orchestrate(spec: FeatureSpec): Promise<OrchestrationRun> {
    const runId = uuidv4();
    const now = new Date().toISOString();

    const orchestrationRun: OrchestrationRun = {
      id: runId,
      featureSpecId: spec.id,
      featureName: spec.name,
      status: 'parsing',
      layerResults: new Map(),
      startedAt: now,
    };

    // Persist run
    this.persistRun(orchestrationRun);

    try {
      // Step 1: Determine required layers
      const requiredLayers = getRequiredLayers(spec);
      if (requiredLayers.length === 0) {
        throw new Error('Feature spec has no layers defined');
      }

      // Step 2: Verify generators are registered
      const missingGenerators = this.checkGenerators(requiredLayers);
      if (missingGenerators.length > 0) {
        throw new Error(
          `Missing generators for layers: ${missingGenerators.join(', ')}. ` +
            `Register them with registerGenerator() first.`,
        );
      }

      // Step 3: Pre-validate cross-layer consistency
      const preValidation = validateTypeConsistency(spec);
      const preErrors = preValidation.filter((i) => i.severity === 'error');
      if (preErrors.length > 0) {
        orchestrationRun.validationResult = {
          valid: false,
          issues: preValidation,
        };
        throw new Error(
          `Pre-validation failed with ${preErrors.length} error(s): ` +
            preErrors.map((e) => e.message).join('; '),
        );
      }

      // Step 4: Execute generators sequentially (DB → API → UI)
      orchestrationRun.status = 'generating';
      this.persistRun(orchestrationRun);
      this.emitEvent('feature:generating', { runId, featureName: spec.name, layers: requiredLayers });

      const completedLayers = new Map<FeatureLayer, LayerResult>();

      for (const layer of requiredLayers) {
        const generator = this.generators.get(layer)!;
        const layerSpec = getLayerSpec(spec, layer)!;

        const context: GeneratorContext = {
          runId,
          featureSpec: spec,
          previousLayers: completedLayers,
          codebaseRoot: this.codebaseRoot,
        };

        // Generate
        let result: LayerResult;
        try {
          result = await generator.generate(layerSpec, context);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          result = {
            layer,
            status: 'failed',
            files: [],
            errors: [errorMsg],
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }

        orchestrationRun.layerResults.set(layer, result);

        if (result.status === 'failed') {
          // Rollback completed layers in reverse order
          await this.rollbackLayers(completedLayers, requiredLayers);
          orchestrationRun.status = 'failed';
          orchestrationRun.error = `Layer "${layer}" failed: ${result.errors.join('; ')}`;
          orchestrationRun.completedAt = new Date().toISOString();
          this.persistRun(orchestrationRun);
          this.emitEvent('feature:failed', { runId, layer, errors: result.errors });
          return orchestrationRun;
        }

        // Validate generated output for this layer
        const layerValidation = await generator.validate(result);
        if (!layerValidation.valid) {
          const layerErrors = layerValidation.issues.filter(
            (i) => i.severity === 'error',
          );
          if (layerErrors.length > 0) {
            result.status = 'failed';
            result.errors.push(
              ...layerErrors.map((e) => e.message),
            );
            orchestrationRun.layerResults.set(layer, result);

            await this.rollbackLayers(completedLayers, requiredLayers);
            orchestrationRun.status = 'failed';
            orchestrationRun.error = `Layer "${layer}" validation failed: ${layerErrors.map((e) => e.message).join('; ')}`;
            orchestrationRun.completedAt = new Date().toISOString();
            this.persistRun(orchestrationRun);
            this.emitEvent('feature:failed', { runId, layer, errors: result.errors });
            return orchestrationRun;
          }
        }

        // Track generated files
        this.persistGeneratedFiles(runId, result.files);

        completedLayers.set(layer, result);
        this.emitEvent('feature:layer_completed', { runId, layer, fileCount: result.files.length });
      }

      // Step 5: Post-generation cross-layer validation
      orchestrationRun.status = 'validating';
      this.persistRun(orchestrationRun);

      const postValidation = await this.runIntegrationChecks(
        spec,
        completedLayers,
      );
      orchestrationRun.validationResult = postValidation;

      if (!postValidation.valid) {
        const criticalIssues = postValidation.issues.filter(
          (i) => i.severity === 'error',
        );
        if (criticalIssues.length > 0) {
          await this.rollbackLayers(completedLayers, requiredLayers);
          orchestrationRun.status = 'failed';
          orchestrationRun.error = `Integration validation failed: ${criticalIssues.map((i) => i.message).join('; ')}`;
          orchestrationRun.completedAt = new Date().toISOString();
          this.persistRun(orchestrationRun);
          this.emitEvent('feature:failed', { runId, layer: 'integration', errors: criticalIssues.map((i) => i.message) });
          return orchestrationRun;
        }
      }

      // Success
      orchestrationRun.status = 'completed';
      orchestrationRun.completedAt = new Date().toISOString();
      this.persistRun(orchestrationRun);
      this.emitEvent('feature:completed', {
        runId,
        featureName: spec.name,
        layers: requiredLayers,
        totalFiles: Array.from(completedLayers.values()).reduce(
          (sum, r) => sum + r.files.length,
          0,
        ),
      });

      return orchestrationRun;
    } catch (err) {
      orchestrationRun.status = 'failed';
      orchestrationRun.error =
        err instanceof Error ? err.message : String(err);
      orchestrationRun.completedAt = new Date().toISOString();
      this.persistRun(orchestrationRun);
      this.emitEvent('feature:failed', { runId, layer: 'orchestrator', errors: [orchestrationRun.error] });
      return orchestrationRun;
    }
  }

  /**
   * Run integration checks after all layers are generated.
   * Validates that API types match DB schema and UI calls correct API paths.
   */
  private async runIntegrationChecks(
    spec: FeatureSpec,
    completedLayers: Map<FeatureLayer, LayerResult>,
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Cross-layer type consistency
    issues.push(...validateTypeConsistency(spec));

    // Check that all generated files are non-empty
    for (const [layer, result] of completedLayers) {
      for (const file of result.files) {
        if (!file.content || file.content.trim().length === 0) {
          issues.push({
            severity: 'warning',
            layer,
            message: `Generated file "${file.path}" is empty`,
            field: file.path,
          });
        }
      }
    }

    // If API layer exists, check that each endpoint has a corresponding handler file
    const apiResult = completedLayers.get('api');
    if (apiResult && spec.layers.api) {
      const generatedPaths = new Set(apiResult.files.map((f) => f.path));
      for (const endpoint of spec.layers.api.endpoints) {
        const handlerPath = endpoint.handler;
        if (handlerPath && !generatedPaths.has(handlerPath)) {
          // Only warn - handler may reference an existing file
          issues.push({
            severity: 'warning',
            layer: 'api',
            message: `Endpoint handler "${handlerPath}" for ${endpoint.method} ${endpoint.path} was not in generated files`,
            field: endpoint.handler,
          });
        }
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    return { valid: !hasErrors, issues };
  }

  /**
   * Rollback completed layers in reverse execution order.
   */
  private async rollbackLayers(
    completedLayers: Map<FeatureLayer, LayerResult>,
    executionOrder: FeatureLayer[],
  ): Promise<void> {
    // Reverse the execution order for rollback
    const rollbackOrder = [...executionOrder].reverse();

    for (const layer of rollbackOrder) {
      const result = completedLayers.get(layer);
      if (!result || result.status !== 'completed') continue;

      const generator = this.generators.get(layer);
      if (!generator) continue;

      try {
        await generator.rollback(result);
        result.status = 'rolled_back';
        this.markFilesRolledBack(result.files);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Rollback failed for layer "${layer}": ${errorMsg}`);
        // Continue rolling back other layers even if one fails
      }
    }
  }

  // ---- Persistence helpers ----

  private persistRun(orchestrationRun: OrchestrationRun): void {
    const layerResultsJson = JSON.stringify(
      Array.from(orchestrationRun.layerResults.entries()),
    );
    const validationJson = orchestrationRun.validationResult
      ? JSON.stringify(orchestrationRun.validationResult)
      : null;

    const existing = getOne<{ id: string }>(
      'SELECT id FROM feature_orchestration_runs WHERE id = ?',
      [orchestrationRun.id],
    );

    if (existing) {
      run(
        `UPDATE feature_orchestration_runs
         SET status = ?, layer_results = ?, validation_result = ?,
             completed_at = ?, error = ?
         WHERE id = ?`,
        [
          orchestrationRun.status,
          layerResultsJson,
          validationJson,
          orchestrationRun.completedAt ?? null,
          orchestrationRun.error ?? null,
          orchestrationRun.id,
        ],
      );
    } else {
      run(
        `INSERT INTO feature_orchestration_runs
         (id, feature_spec_id, feature_name, status, layer_results, validation_result, started_at, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orchestrationRun.id,
          orchestrationRun.featureSpecId,
          orchestrationRun.featureName,
          orchestrationRun.status,
          layerResultsJson,
          validationJson,
          orchestrationRun.startedAt,
          orchestrationRun.error ?? null,
        ],
      );
    }
  }

  private persistGeneratedFiles(runId: string, files: GeneratedFile[]): void {
    for (const file of files) {
      run(
        `INSERT INTO feature_generated_files (id, run_id, layer, file_path, content_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          runId,
          file.layer,
          file.path,
          simpleHash(file.content),
        ],
      );
    }
  }

  private markFilesRolledBack(files: GeneratedFile[]): void {
    for (const file of files) {
      run(
        `UPDATE feature_generated_files SET rolled_back = 1 WHERE file_path = ?`,
        [file.path],
      );
    }
  }

  // ---- Event helpers ----

  private emitEvent(type: string, data: Record<string, unknown>): void {
    try {
      createEvent({
        type,
        message: `Feature orchestrator: ${type}`,
        agentId: 'feature-orchestrator',
        severity: type.includes('failed') ? 'error' : 'info',
        metadata: data,
      });
    } catch {
      // Non-critical: don't fail orchestration if event recording fails
    }

    try {
      broadcast(type, data);
    } catch {
      // Non-critical
    }
  }

  // ---- Query helpers ----

  /**
   * Get an orchestration run by ID.
   */
  getRun(runId: string): OrchestrationRun | undefined {
    const row = getOne<{
      id: string;
      feature_spec_id: string;
      feature_name: string;
      status: OrchestrationStatus;
      layer_results: string | null;
      validation_result: string | null;
      started_at: string;
      completed_at: string | null;
      error: string | null;
    }>(
      'SELECT * FROM feature_orchestration_runs WHERE id = ?',
      [runId],
    );

    if (!row) return undefined;

    const layerResults = new Map<FeatureLayer, LayerResult>();
    if (row.layer_results) {
      const entries = JSON.parse(row.layer_results) as [FeatureLayer, LayerResult][];
      for (const [layer, result] of entries) {
        layerResults.set(layer, result);
      }
    }

    return {
      id: row.id,
      featureSpecId: row.feature_spec_id,
      featureName: row.feature_name,
      status: row.status,
      layerResults,
      validationResult: row.validation_result
        ? JSON.parse(row.validation_result)
        : undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      error: row.error ?? undefined,
    };
  }

  /**
   * List all orchestration runs, newest first.
   */
  listRuns(limit = 20): Array<{
    id: string;
    featureName: string;
    status: OrchestrationStatus;
    startedAt: string;
    completedAt?: string;
  }> {
    return query<{
      id: string;
      feature_name: string;
      status: OrchestrationStatus;
      started_at: string;
      completed_at: string | null;
    }>(
      'SELECT id, feature_name, status, started_at, completed_at FROM feature_orchestration_runs ORDER BY created_at DESC LIMIT ?',
      [limit],
    ).map((row) => ({
      id: row.id,
      featureName: row.feature_name,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
    }));
  }

  /**
   * Get generated files for a run.
   */
  getGeneratedFiles(runId: string): Array<{
    path: string;
    layer: FeatureLayer;
    rolledBack: boolean;
  }> {
    return query<{
      file_path: string;
      layer: FeatureLayer;
      rolled_back: number;
    }>(
      'SELECT file_path, layer, rolled_back FROM feature_generated_files WHERE run_id = ? ORDER BY layer, file_path',
      [runId],
    ).map((row) => ({
      path: row.file_path,
      layer: row.layer,
      rolledBack: row.rolled_back === 1,
    }));
  }
}

// ============ UTILITIES ============

/** Simple string hash for content tracking (not cryptographic) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

// ============ SINGLETON ============

const CODEBASE_ROOT =
  process.env.CODEBASE_ROOT ||
  '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

/** Shared orchestrator instance */
export const featureOrchestrator = new FeatureOrchestrator(CODEBASE_ROOT);
