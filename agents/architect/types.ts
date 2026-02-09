/**
 * Architect Agent Types
 *
 * Type definitions for architecture documents, component specifications,
 * tech stack decisions, and other architecture artifacts.
 */

/**
 * Architecture document - high-level system design
 */
export interface ArchitectureDoc {
  projectName: string;
  version: string;
  overview: string;
  systemContext: string;
  components: ComponentSpec[];
  techStack: TechStackDecision;
  apiContracts: APIContract[];
  databaseSchema: DatabaseSchema;
  deploymentArchitecture?: DeploymentArchitecture;
  qualityAttributes: QualityAttribute[];
  constraints: string[];
  risks: ArchitectureRisk[];
  metadata: {
    createdAt: Date;
    lastModified: Date;
    author: string;
    version: string;
  };
}

/**
 * Component specification - describes a single component/module
 */
export interface ComponentSpec {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'service' | 'library' | 'infrastructure';
  description: string;
  responsibilities: string[];
  dependencies: string[];
  interfaces: ComponentInterface[];
  technology: string;
  designPatterns: string[];
  securityConsiderations?: string[];
  performanceConsiderations?: string[];
}

/**
 * Component interface - how components interact
 */
export interface ComponentInterface {
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'websocket' | 'event' | 'function';
  direction: 'inbound' | 'outbound';
  description: string;
  contract?: string;
}

/**
 * Tech stack decision - rationale for technology choices
 */
export interface TechStackDecision {
  frontend?: TechChoice;
  backend?: TechChoice;
  database?: TechChoice;
  infrastructure?: TechChoice;
  testing?: TechChoice;
  cicd?: TechChoice;
  monitoring?: TechChoice;
  otherTools?: Record<string, TechChoice>;
}

/**
 * Individual technology choice with rationale
 */
export interface TechChoice {
  name: string;
  version?: string;
  rationale: string;
  alternatives: string[];
  tradeoffs: string[];
  constraints?: string[];
}

/**
 * API contract - defines API interface
 */
export interface APIContract {
  id: string;
  name: string;
  type: 'rest' | 'graphql' | 'grpc' | 'websocket';
  baseUrl?: string;
  version: string;
  endpoints?: RESTEndpoint[];
  queries?: GraphQLOperation[];
  mutations?: GraphQLOperation[];
  subscriptions?: GraphQLOperation[];
  authentication?: AuthenticationSpec;
  rateLimit?: RateLimitSpec;
}

/**
 * REST API endpoint
 */
export interface RESTEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description: string;
  parameters?: Parameter[];
  requestBody?: SchemaRef;
  responses: Record<number, ResponseSpec>;
  authentication?: boolean;
  rateLimit?: RateLimitSpec;
}

/**
 * GraphQL operation (query/mutation/subscription)
 */
export interface GraphQLOperation {
  name: string;
  description: string;
  arguments?: Parameter[];
  returnType: string;
  authentication?: boolean;
}

/**
 * Parameter definition
 */
export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: string;
  default?: unknown;
}

/**
 * Schema reference
 */
export interface SchemaRef {
  schema: string;
  example?: unknown;
}

/**
 * Response specification
 */
export interface ResponseSpec {
  description: string;
  schema?: SchemaRef;
  headers?: Record<string, string>;
}

/**
 * Authentication specification
 */
export interface AuthenticationSpec {
  type: 'jwt' | 'oauth2' | 'apikey' | 'basic' | 'custom';
  description: string;
  flow?: string;
  tokenLocation?: string;
}

/**
 * Rate limiting specification
 */
export interface RateLimitSpec {
  maxRequests: number;
  windowMs: number;
  strategy: 'fixed' | 'sliding' | 'token-bucket';
}

/**
 * Database schema - defines data model
 */
export interface DatabaseSchema {
  type: 'sql' | 'nosql' | 'graph' | 'timeseries' | 'hybrid';
  tables?: TableSchema[];
  collections?: CollectionSchema[];
  relationships?: Relationship[];
  indexes?: IndexSpec[];
  migrations?: MigrationStrategy;
}

/**
 * SQL table schema
 */
export interface TableSchema {
  name: string;
  description: string;
  columns: ColumnSpec[];
  primaryKey: string[];
  uniqueConstraints?: string[][];
  checkConstraints?: string[];
}

/**
 * Column specification
 */
export interface ColumnSpec {
  name: string;
  type: string;
  nullable: boolean;
  default?: unknown;
  description: string;
}

/**
 * NoSQL collection schema
 */
export interface CollectionSchema {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  validation?: Record<string, unknown>;
}

/**
 * Relationship between entities
 */
export interface Relationship {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  from: string;
  to: string;
  foreignKey?: string;
  description: string;
}

/**
 * Index specification
 */
export interface IndexSpec {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type?: 'btree' | 'hash' | 'gin' | 'gist';
}

/**
 * Migration strategy
 */
export interface MigrationStrategy {
  approach: 'schema-first' | 'code-first' | 'migrations';
  tool?: string;
  versionControl: boolean;
}

/**
 * Deployment architecture
 */
export interface DeploymentArchitecture {
  strategy: 'monolith' | 'microservices' | 'serverless' | 'hybrid';
  environments: Environment[];
  scaling: ScalingStrategy;
  monitoring: MonitoringStrategy;
}

/**
 * Environment specification
 */
export interface Environment {
  name: string;
  purpose: string;
  infrastructure: string;
  configuration: Record<string, unknown>;
}

/**
 * Scaling strategy
 */
export interface ScalingStrategy {
  type: 'horizontal' | 'vertical' | 'hybrid';
  triggers: string[];
  limits: Record<string, number>;
}

/**
 * Monitoring strategy
 */
export interface MonitoringStrategy {
  metrics: string[];
  logging: LoggingConfig;
  tracing: TracingConfig;
  alerting: AlertingConfig;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: string;
  destinations: string[];
  format: string;
}

/**
 * Tracing configuration
 */
export interface TracingConfig {
  enabled: boolean;
  provider?: string;
  samplingRate?: number;
}

/**
 * Alerting configuration
 */
export interface AlertingConfig {
  channels: string[];
  rules: AlertRule[];
}

/**
 * Alert rule
 */
export interface AlertRule {
  name: string;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notification: string[];
}

/**
 * Quality attribute (non-functional requirement)
 */
export interface QualityAttribute {
  name: string;
  category: 'performance' | 'security' | 'reliability' | 'maintainability' | 'scalability' | 'usability';
  requirement: string;
  measurement: string;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
}

/**
 * Architecture risk
 */
export interface ArchitectureRisk {
  id: string;
  category: 'technical' | 'security' | 'performance' | 'operational' | 'business';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: 'low' | 'medium' | 'high';
  mitigation: string;
  owner?: string;
}

/**
 * Architect Agent input - requirements for architecture generation
 */
export interface ArchitectInput {
  projectName: string;
  requirements: string;
  constraints?: string[];
  preferences?: {
    techStack?: string[];
    patterns?: string[];
    scalability?: string;
    budget?: string;
  };
  existingContext?: {
    codebase?: string;
    infrastructure?: string;
    team?: string;
  };
}

/**
 * Architect Agent output - generated architecture artifacts
 */
export interface ArchitectOutput {
  architecture: ArchitectureDoc;
  diagrams?: {
    systemContext?: string;
    containers?: string;
    components?: string;
    deployment?: string;
  };
  documentation: string;
  recommendations: string[];
  nextSteps: string[];
  metadata: {
    tokensUsed: number;
    generatedAt: Date;
    confidence: number;
  };
}
