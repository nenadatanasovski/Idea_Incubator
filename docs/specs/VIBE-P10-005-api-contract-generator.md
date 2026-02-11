# VIBE-P10-005: API Contract Generator

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-02-09
**Priority:** P1 (Phase 10 - Architecture Agent Foundation)
**Effort:** Medium (10-14 hours)
**Model:** Opus
**Agent Type:** build_agent

---

## Overview

Implement an API Contract Generator that transforms natural language API requirements into valid OpenAPI 3.0 specifications in YAML format. The generator parses requirements to extract endpoints, HTTP methods, request/response schemas with validation rules, authentication requirements, and generates comprehensive examples. It integrates with the Architect Agent to automate API contract documentation from requirements.

### Problem Statement

**Current State:**

- Architect Agent has `APIContract` interface defined in types (line 89-101 of `agents/architect/types.ts`)
- `API_CONTRACT_PROMPT` exists for guiding API design (line 120-158 of `agents/architect/prompts.ts`)
- No automated generation of OpenAPI 3.0 specifications from requirements
- Manual creation of API contracts is time-consuming and error-prone
- No validation that generated specs conform to OpenAPI 3.0 standard
- No standardized example generation for endpoints

**Desired State:**

- `APIContractGenerator` class at `agents/architect/generators/api-contract-generator.ts`
- Parser that extracts API requirements from natural language
- Generator that produces valid OpenAPI 3.0 YAML specifications
- Comprehensive schema definitions with validation rules
- Authentication/authorization specifications
- Example requests/responses for all endpoints
- Versioning support in generated specs
- Integration with `swagger-cli validate` for verification

### Value Proposition

The API Contract Generator is the **"API Documentation Automation Engine"** that accelerates API-first development:

1. **Automated Documentation** - Generate OpenAPI specs from requirements in seconds
2. **Consistency Across APIs** - Standardized structure for all API contracts
3. **Design-First Development** - Define contracts before implementation
4. **Validation Built-In** - Ensure specs conform to OpenAPI 3.0 standard
5. **Developer Experience** - Comprehensive examples reduce integration time
6. **Maintainability** - Single source of truth for API contracts
7. **Tooling Integration** - Compatible with Swagger UI, Postman, code generators

---

## Requirements

### Functional Requirements

#### 1. Natural Language Requirements Parser

**FR-1.1: Endpoint Extraction**

- Parse natural language text to identify API endpoints
- Extract endpoint patterns: `GET /users/{id}`, `POST /auth/login`, etc.
- Recognize HTTP methods: GET, POST, PUT, PATCH, DELETE
- Extract path parameters from URL patterns (e.g., `{id}`, `{slug}`)
- Identify query parameters with types and requirements
- Support grouping endpoints by resource or tag

**FR-1.2: Schema Inference**

- Identify request body structure from requirements
- Identify response body structure from requirements
- Infer data types: string, number, integer, boolean, array, object
- Recognize nested objects and arrays
- Extract validation rules: required, min/max length, patterns, enums
- Support schema references for reusable components

**FR-1.3: Authentication Requirements**

- Identify authentication mechanisms: JWT, OAuth2, API Key, Basic Auth
- Extract token location: header, query, cookie
- Parse OAuth2 flows: authorization code, implicit, client credentials, password
- Identify security scopes and permissions
- Support multiple authentication schemes per endpoint

**FR-1.4: Status Code Detection**

- Identify success responses (200, 201, 204)
- Identify client error responses (400, 401, 403, 404)
- Identify server error responses (500, 503)
- Extract error response schemas
- Associate descriptions with each status code

#### 2. APIContractGenerator Class

**FR-2.1: Class Structure**

```typescript
class APIContractGenerator {
  constructor(config?: APIContractGeneratorConfig);
  generateSpec(requirements: APIRequirements): Promise<OpenAPISpec>;
  generateYAML(spec: OpenAPISpec): string;
  validate(yaml: string): Promise<ValidationResult>;
  parseRequirements(text: string): Promise<APIRequirements>;
}
```

**FR-2.2: Configuration Options**

```typescript
interface APIContractGeneratorConfig {
  defaultVersion?: string; // Default: "1.0.0"
  baseUrl?: string; // Default: "https://api.example.com"
  includeExamples?: boolean; // Default: true
  includeSchemas?: boolean; // Default: true
  authDefaults?: SecurityScheme; // Default auth scheme
  verbose?: boolean; // Default: false
}
```

**FR-2.3: Core Capabilities**

- Generate complete OpenAPI 3.0 specification object
- Convert specification object to valid YAML format
- Validate generated YAML against OpenAPI 3.0 schema
- Parse natural language requirements into structured format
- Generate request/response examples automatically
- Support versioning (path-based, header-based, query-based)

#### 3. OpenAPI 3.0 Specification Generation

**FR-3.1: OpenAPI Structure**
Generate complete OpenAPI 3.0 spec with:

- `openapi: "3.0.3"` version declaration
- `info` object: title, version, description, contact, license
- `servers` array: URLs for different environments (dev, staging, prod)
- `paths` object: All endpoints with operations
- `components` object: Reusable schemas, parameters, responses, security schemes
- `security` array: Global security requirements
- `tags` array: Endpoint grouping and organization

**FR-3.2: Path Item Generation**
For each endpoint generate:

- Operation ID (unique identifier)
- Summary (brief description)
- Description (detailed explanation)
- Tags (categorization)
- Parameters (path, query, header, cookie)
- Request body (schema, examples, content types)
- Responses (status codes, schemas, examples, headers)
- Security requirements (operation-level overrides)
- Deprecated flag (if applicable)

**FR-3.3: Schema Generation**
Generate JSON Schema definitions with:

- Type specification (string, number, integer, boolean, array, object, null)
- Format hints (date-time, email, uri, uuid, etc.)
- Validation constraints:
  - `required` fields
  - `minLength`, `maxLength` for strings
  - `minimum`, `maximum` for numbers
  - `pattern` (regex) for strings
  - `enum` for constrained values
  - `items` for arrays
  - `properties` for objects
- Default values
- Descriptions for all fields
- Examples for each schema

**FR-3.4: Security Scheme Generation**
Generate security scheme definitions:

- **JWT/Bearer**: `type: http`, `scheme: bearer`, `bearerFormat: JWT`
- **OAuth2**: `type: oauth2`, flows (authorizationCode, implicit, clientCredentials, password)
- **API Key**: `type: apiKey`, `in: header|query|cookie`, `name: X-API-Key`
- **Basic Auth**: `type: http`, `scheme: basic`
- **Custom**: Extensible for custom auth schemes

#### 4. Example Generation

**FR-4.1: Request Examples**
Generate realistic examples for:

- Path parameters: `{ "id": "123e4567-e89b-12d3-a456-426614174000" }`
- Query parameters: `{ "limit": 10, "offset": 0, "sort": "created_at" }`
- Request bodies:
  - JSON objects with all required fields
  - Nested structures
  - Arrays with sample items
  - Realistic values based on field names and types

**FR-4.2: Response Examples**
Generate examples for each status code:

- `200 OK`: Success response with full data structure
- `201 Created`: Created resource with ID and metadata
- `400 Bad Request`: Validation error with field-level details
- `401 Unauthorized`: Authentication failure message
- `404 Not Found`: Resource not found message
- `500 Internal Server Error`: Generic error structure

**FR-4.3: Example Value Inference**
Infer realistic values based on field names:

- `id`, `uuid`: UUID v4 format
- `email`: `user@example.com`
- `name`, `firstName`, `lastName`: Common names
- `created_at`, `updated_at`: ISO 8601 timestamps
- `url`, `link`: Valid URLs
- `count`, `total`: Positive integers
- `price`, `amount`: Decimal numbers with currency precision

#### 5. Versioning Support

**FR-5.1: API Version Strategies**
Support multiple versioning approaches:

- **Path-based**: `/v1/users`, `/v2/users`
- **Header-based**: `Accept: application/vnd.api.v1+json`
- **Query parameter**: `/users?version=1`
- **Subdomain**: `v1.api.example.com`

**FR-5.2: Version Metadata**
Include version information:

- `info.version`: Semantic version (e.g., "1.2.0")
- `servers` URLs reflecting versioned paths
- Deprecation notices for old versions
- Migration guides in descriptions
- Breaking vs non-breaking change documentation

#### 6. Validation Integration

**FR-6.1: Schema Validation**
Validate generated YAML:

- Use `swagger-cli validate` for OpenAPI 3.0 compliance
- Check required fields are present
- Verify schema references are valid
- Ensure examples match schemas
- Validate security scheme references

**FR-6.2: Validation Result**

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  spec?: OpenAPISpec;
}

interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}
```

### Non-Functional Requirements

**NFR-1: Specification Quality**

- Generated specs must pass `swagger-cli validate` with zero errors
- All endpoints must include descriptions and examples
- Schemas must be fully typed with validation rules
- Authentication requirements must be clear and complete
- Generated YAML must be properly formatted and human-readable

**NFR-2: Performance**

- Generate OpenAPI spec from requirements in < 5 seconds
- Parse requirements text in < 2 seconds
- YAML generation and validation in < 1 second
- Support specs with 100+ endpoints without performance degradation

**NFR-3: Extensibility**

- Support custom authentication schemes
- Allow custom schema templates
- Enable custom example generators
- Support OpenAPI extensions (x-\* fields)
- Pluggable requirement parsers for different formats

**NFR-4: Type Safety**

- All generator methods strongly typed
- OpenAPI spec types match specification exactly
- No `any` types in public APIs
- Compile-time safety for schema generation

**NFR-5: Error Handling**

- Clear error messages for malformed requirements
- Validation errors include line numbers and paths
- Graceful degradation for partial requirements
- Helpful suggestions for fixing common issues

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              APIContractGenerator                               │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  1. Requirements Parser                                   ┃  │
│  ┃     - Natural language → structured requirements         ┃  │
│  ┃     - Endpoint extraction, schema inference              ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  2. OpenAPI Builder                                       ┃  │
│  ┃     - Info, servers, paths, components                   ┃  │
│  ┃     - Schema generation, security schemes                ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  3. Example Generator                                     ┃  │
│  ┃     - Request examples, response examples                ┃  │
│  ┃     - Value inference from field names                   ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  4. YAML Serializer                                       ┃  │
│  ┃     - OpenAPI object → YAML string                       ┃  │
│  ┃     - Pretty formatting, comment preservation            ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃  5. Validator                                             ┃  │
│  ┃     - swagger-cli integration                            ┃  │
│  ┃     - Schema validation, example validation              ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌────────────┐      ┌────────────┐      ┌────────────┐
  │   YAML     │      │  swagger-  │      │ Architect  │
  │   Parser   │      │    cli     │      │   Agent    │
  │ (js-yaml)  │      │  validate  │      │            │
  └────────────┘      └────────────┘      └────────────┘
```

### Type Definitions

```typescript
// agents/architect/generators/types.ts

/**
 * Parsed API requirements from natural language
 */
export interface APIRequirements {
  title: string;
  description?: string;
  version: string;
  baseUrl?: string;
  endpoints: EndpointRequirement[];
  authentication?: AuthRequirement;
  globalParameters?: ParameterRequirement[];
  tags?: TagRequirement[];
}

export interface EndpointRequirement {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterRequirement[];
  requestBody?: SchemaRequirement;
  responses: ResponseRequirement[];
  authentication?: boolean;
  deprecated?: boolean;
}

export interface ParameterRequirement {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  type: string;
  required: boolean;
  description?: string;
  default?: unknown;
  example?: unknown;
  validation?: ValidationRule;
}

export interface SchemaRequirement {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  properties?: Record<string, PropertyRequirement>;
  items?: SchemaRequirement;
  required?: string[];
  description?: string;
  example?: unknown;
}

export interface PropertyRequirement {
  type: string;
  format?: string;
  description?: string;
  required?: boolean;
  validation?: ValidationRule;
  example?: unknown;
  enum?: unknown[];
}

export interface ValidationRule {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
}

export interface ResponseRequirement {
  status: number;
  description: string;
  schema?: SchemaRequirement;
  headers?: Record<string, HeaderRequirement>;
  example?: unknown;
}

export interface HeaderRequirement {
  type: string;
  description: string;
  required?: boolean;
}

export interface AuthRequirement {
  type: "jwt" | "oauth2" | "apikey" | "basic" | "custom";
  scheme?: string;
  bearerFormat?: string;
  location?: "header" | "query" | "cookie";
  name?: string;
  flows?: OAuth2Flows;
  description?: string;
}

export interface OAuth2Flows {
  authorizationCode?: OAuth2Flow;
  implicit?: OAuth2Flow;
  clientCredentials?: OAuth2Flow;
  password?: OAuth2Flow;
}

export interface OAuth2Flow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface TagRequirement {
  name: string;
  description?: string;
}

/**
 * OpenAPI 3.0 Specification Types
 */
export interface OpenAPISpec {
  openapi: "3.0.3";
  info: InfoObject;
  servers?: ServerObject[];
  paths: PathsObject;
  components?: ComponentsObject;
  security?: SecurityRequirement[];
  tags?: TagObject[];
}

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
  contact?: ContactObject;
  license?: LicenseObject;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  url?: string;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

export interface PathsObject {
  [path: string]: PathItemObject;
}

export interface PathItemObject {
  summary?: string;
  description?: string;
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  parameters?: ParameterObject[];
}

export interface OperationObject {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: ResponsesObject;
  security?: SecurityRequirement[];
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema: SchemaObject;
  example?: unknown;
}

export interface RequestBodyObject {
  description?: string;
  content: ContentObject;
  required?: boolean;
}

export interface ContentObject {
  [mediaType: string]: MediaTypeObject;
}

export interface MediaTypeObject {
  schema: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
}

export interface ResponsesObject {
  [statusCode: string]: ResponseObject;
}

export interface ResponseObject {
  description: string;
  content?: ContentObject;
  headers?: Record<string, HeaderObject>;
}

export interface HeaderObject {
  description?: string;
  required?: boolean;
  schema: SchemaObject;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  $ref?: string;
}

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject>;
  responses?: Record<string, ResponseObject>;
  parameters?: Record<string, ParameterObject>;
  requestBodies?: Record<string, RequestBodyObject>;
  securitySchemes?: Record<string, SecuritySchemeObject>;
}

export interface SecuritySchemeObject {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  description?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuth2FlowsObject;
  openIdConnectUrl?: string;
}

export interface OAuth2FlowsObject {
  implicit?: OAuth2FlowObject;
  password?: OAuth2FlowObject;
  clientCredentials?: OAuth2FlowObject;
  authorizationCode?: OAuth2FlowObject;
}

export interface OAuth2FlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface SecurityRequirement {
  [name: string]: string[];
}

export interface TagObject {
  name: string;
  description?: string;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
}

/**
 * Generator configuration
 */
export interface APIContractGeneratorConfig {
  defaultVersion?: string;
  baseUrl?: string;
  includeExamples?: boolean;
  includeSchemas?: boolean;
  authDefaults?: AuthRequirement;
  verbose?: boolean;
  yamlIndent?: number;
  useRefs?: boolean; // Use $ref for reusable schemas
}

/**
 * Validation results
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  spec?: OpenAPISpec;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
  line?: number;
  column?: number;
}
```

### APIContractGenerator Implementation

```typescript
// agents/architect/generators/api-contract-generator.ts

import yaml from "js-yaml";
import { v4 as uuid } from "uuid";
import {
  APIRequirements,
  OpenAPISpec,
  APIContractGeneratorConfig,
  ValidationResult,
  EndpointRequirement,
  SchemaRequirement,
  PathsObject,
  OperationObject,
  SchemaObject,
  ComponentsObject,
} from "./types.js";

/**
 * API Contract Generator
 *
 * Generates OpenAPI 3.0 specifications from natural language requirements.
 * Includes schema generation, validation, example creation, and YAML output.
 */
export class APIContractGenerator {
  private config: Required<APIContractGeneratorConfig>;

  constructor(config: APIContractGeneratorConfig = {}) {
    this.config = {
      defaultVersion: config.defaultVersion || "1.0.0",
      baseUrl: config.baseUrl || "https://api.example.com",
      includeExamples: config.includeExamples !== false,
      includeSchemas: config.includeSchemas !== false,
      authDefaults: config.authDefaults || { type: "jwt" },
      verbose: config.verbose || false,
      yamlIndent: config.yamlIndent || 2,
      useRefs: config.useRefs !== false,
    };
  }

  /**
   * Main entry point: Generate OpenAPI spec from requirements
   */
  async generateSpec(requirements: APIRequirements): Promise<OpenAPISpec> {
    const spec: OpenAPISpec = {
      openapi: "3.0.3",
      info: this.buildInfo(requirements),
      servers: this.buildServers(requirements),
      paths: this.buildPaths(requirements),
      tags: requirements.tags?.map((tag) => ({
        name: tag.name,
        description: tag.description,
      })),
    };

    // Build components (schemas, security schemes, etc.)
    if (this.config.includeSchemas || requirements.authentication) {
      spec.components = this.buildComponents(requirements);
    }

    // Add global security requirements
    if (requirements.authentication) {
      spec.security = this.buildGlobalSecurity(requirements);
    }

    return spec;
  }

  /**
   * Convert OpenAPI spec to YAML string
   */
  generateYAML(spec: OpenAPISpec): string {
    return yaml.dump(spec, {
      indent: this.config.yamlIndent,
      lineWidth: 120,
      noRefs: false,
      sortKeys: false,
    });
  }

  /**
   * Validate OpenAPI YAML
   */
  async validate(yamlContent: string): Promise<ValidationResult> {
    try {
      // Parse YAML
      const spec = yaml.load(yamlContent) as OpenAPISpec;

      // Basic validation
      const errors: ValidationResult["errors"] = [];
      const warnings: string[] = [];

      // Check required fields
      if (!spec.openapi) {
        errors.push({
          path: "/openapi",
          message: "Missing required field: openapi",
          severity: "error",
        });
      }

      if (!spec.info) {
        errors.push({
          path: "/info",
          message: "Missing required field: info",
          severity: "error",
        });
      }

      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        errors.push({
          path: "/paths",
          message: "Paths object is empty or missing",
          severity: "error",
        });
      }

      // Validate security scheme references
      if (spec.security) {
        const securitySchemes = spec.components?.securitySchemes || {};
        for (const requirement of spec.security) {
          for (const schemeName of Object.keys(requirement)) {
            if (!securitySchemes[schemeName]) {
              errors.push({
                path: `/security/${schemeName}`,
                message: `Security scheme '${schemeName}' not defined in components`,
                severity: "error",
              });
            }
          }
        }
      }

      // Validate schema references
      this.validateSchemaRefs(spec, errors);

      // Additional warnings
      if (!spec.servers || spec.servers.length === 0) {
        warnings.push("No servers defined - consider adding server URLs");
      }

      return {
        valid: errors.filter((e) => e.severity === "error").length === 0,
        errors,
        warnings,
        spec,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: "/",
            message: `YAML parsing error: ${error instanceof Error ? error.message : String(error)}`,
            severity: "error",
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Parse natural language requirements (placeholder for LLM integration)
   */
  async parseRequirements(text: string): Promise<APIRequirements> {
    // TODO: Integrate with LLM to parse natural language
    // For now, this is a placeholder that would be enhanced with AI
    throw new Error(
      "Natural language parsing not yet implemented. Use structured APIRequirements instead.",
    );
  }

  // ========== Private Helper Methods ==========

  private buildInfo(requirements: APIRequirements) {
    return {
      title: requirements.title,
      version: requirements.version || this.config.defaultVersion,
      description: requirements.description,
    };
  }

  private buildServers(requirements: APIRequirements) {
    const baseUrl = requirements.baseUrl || this.config.baseUrl;
    return [
      {
        url: baseUrl,
        description: "Production server",
      },
    ];
  }

  private buildPaths(requirements: APIRequirements): PathsObject {
    const paths: PathsObject = {};

    for (const endpoint of requirements.endpoints) {
      const path = endpoint.path;

      if (!paths[path]) {
        paths[path] = {};
      }

      const method = endpoint.method.toLowerCase() as
        | "get"
        | "post"
        | "put"
        | "patch"
        | "delete";
      paths[path][method] = this.buildOperation(endpoint);
    }

    return paths;
  }

  private buildOperation(endpoint: EndpointRequirement): OperationObject {
    const operationId = this.generateOperationId(endpoint);

    const operation: OperationObject = {
      operationId,
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      responses: this.buildResponses(endpoint),
    };

    // Add parameters
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      operation.parameters = endpoint.parameters.map((param) => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required,
        schema: this.buildParameterSchema(param),
        example: this.config.includeExamples
          ? param.example || this.generateExampleValue(param.name, param.type)
          : undefined,
      }));
    }

    // Add request body
    if (endpoint.requestBody) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: this.buildSchema(endpoint.requestBody),
            example: this.config.includeExamples
              ? this.generateSchemaExample(endpoint.requestBody)
              : undefined,
          },
        },
      };
    }

    // Add security
    if (endpoint.authentication !== false) {
      operation.security = [{ bearerAuth: [] }];
    }

    if (endpoint.deprecated) {
      operation.deprecated = true;
    }

    return operation;
  }

  private buildResponses(endpoint: EndpointRequirement) {
    const responses: OperationObject["responses"] = {};

    for (const response of endpoint.responses) {
      const statusCode = String(response.status);

      responses[statusCode] = {
        description: response.description,
      };

      if (response.schema) {
        responses[statusCode].content = {
          "application/json": {
            schema: this.buildSchema(response.schema),
            example: this.config.includeExamples
              ? response.example || this.generateSchemaExample(response.schema)
              : undefined,
          },
        };
      }

      if (response.headers) {
        responses[statusCode].headers = {};
        for (const [name, header] of Object.entries(response.headers)) {
          responses[statusCode].headers![name] = {
            description: header.description,
            schema: { type: header.type },
          };
        }
      }
    }

    return responses;
  }

  private buildSchema(schemaReq: SchemaRequirement): SchemaObject {
    const schema: SchemaObject = {
      type: schemaReq.type,
      description: schemaReq.description,
    };

    if (schemaReq.type === "object" && schemaReq.properties) {
      schema.properties = {};
      for (const [name, prop] of Object.entries(schemaReq.properties)) {
        schema.properties[name] = {
          type: prop.type,
          format: prop.format,
          description: prop.description,
          example: this.config.includeExamples
            ? this.generateExampleValue(name, prop.type)
            : undefined,
          ...(prop.validation || {}),
        };
      }

      if (schemaReq.required) {
        schema.required = schemaReq.required;
      }
    }

    if (schemaReq.type === "array" && schemaReq.items) {
      schema.items = this.buildSchema(schemaReq.items);
    }

    return schema;
  }

  private buildParameterSchema(param: any): SchemaObject {
    return {
      type: param.type,
      ...(param.validation || {}),
    };
  }

  private buildComponents(requirements: APIRequirements): ComponentsObject {
    const components: ComponentsObject = {};

    // Add security schemes
    if (requirements.authentication) {
      components.securitySchemes = {
        bearerAuth: this.buildSecurityScheme(requirements.authentication),
      };
    }

    // TODO: Add reusable schemas from endpoint definitions
    // This would extract common schemas and create $ref references

    return components;
  }

  private buildSecurityScheme(auth: any) {
    switch (auth.type) {
      case "jwt":
        return {
          type: "http" as const,
          scheme: "bearer",
          bearerFormat: "JWT",
          description: auth.description || "JWT Bearer token authentication",
        };

      case "apikey":
        return {
          type: "apiKey" as const,
          in: auth.location || "header",
          name: auth.name || "X-API-Key",
          description: auth.description || "API key authentication",
        };

      case "oauth2":
        return {
          type: "oauth2" as const,
          flows: auth.flows,
          description: auth.description || "OAuth 2.0 authentication",
        };

      case "basic":
        return {
          type: "http" as const,
          scheme: "basic",
          description: auth.description || "HTTP Basic authentication",
        };

      default:
        return {
          type: "http" as const,
          scheme: "bearer",
        };
    }
  }

  private buildGlobalSecurity(requirements: APIRequirements) {
    return [{ bearerAuth: [] }];
  }

  private generateOperationId(endpoint: EndpointRequirement): string {
    // Convert path to camelCase operation ID
    // e.g., GET /users/{id} -> getUsersById
    const method = endpoint.method.toLowerCase();
    const pathParts = endpoint.path
      .split("/")
      .filter((p) => p && !p.startsWith("{"))
      .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)));

    return method + pathParts.join("");
  }

  private generateExampleValue(fieldName: string, type: string): unknown {
    const lowerName = fieldName.toLowerCase();

    // UUID/ID fields
    if (lowerName.includes("id") || lowerName.includes("uuid")) {
      return uuid();
    }

    // Email fields
    if (lowerName.includes("email")) {
      return "user@example.com";
    }

    // Name fields
    if (lowerName.includes("name")) {
      if (lowerName.includes("first")) return "John";
      if (lowerName.includes("last")) return "Doe";
      return "Example Name";
    }

    // Timestamp fields
    if (
      lowerName.includes("created") ||
      lowerName.includes("updated") ||
      lowerName.includes("date") ||
      lowerName.includes("time")
    ) {
      return new Date().toISOString();
    }

    // URL fields
    if (lowerName.includes("url") || lowerName.includes("link")) {
      return "https://example.com";
    }

    // Count/numeric fields
    if (
      lowerName.includes("count") ||
      lowerName.includes("total") ||
      lowerName.includes("number")
    ) {
      return 42;
    }

    // Price/amount fields
    if (
      lowerName.includes("price") ||
      lowerName.includes("amount") ||
      lowerName.includes("cost")
    ) {
      return 99.99;
    }

    // Default by type
    switch (type) {
      case "string":
        return "example string";
      case "integer":
      case "number":
        return 0;
      case "boolean":
        return true;
      default:
        return null;
    }
  }

  private generateSchemaExample(schema: SchemaRequirement): unknown {
    if (schema.example) {
      return schema.example;
    }

    if (schema.type === "object" && schema.properties) {
      const example: Record<string, unknown> = {};
      for (const [name, prop] of Object.entries(schema.properties)) {
        example[name] = this.generateExampleValue(name, prop.type);
      }
      return example;
    }

    if (schema.type === "array" && schema.items) {
      return [this.generateSchemaExample(schema.items)];
    }

    return this.generateExampleValue("value", schema.type);
  }

  private validateSchemaRefs(
    spec: OpenAPISpec,
    errors: ValidationResult["errors"],
  ): void {
    const schemas = spec.components?.schemas || {};

    // Helper to check if $ref exists
    const checkRef = (ref: string, path: string) => {
      if (ref.startsWith("#/components/schemas/")) {
        const schemaName = ref.replace("#/components/schemas/", "");
        if (!schemas[schemaName]) {
          errors.push({
            path,
            message: `Schema reference '${ref}' not found in components`,
            severity: "error",
          });
        }
      }
    };

    // Validate refs in paths
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (
          typeof operation === "object" &&
          operation !== null &&
          "responses" in operation
        ) {
          // Check response schemas
          for (const [status, response] of Object.entries(
            (operation as OperationObject).responses,
          )) {
            if ("content" in response && response.content) {
              for (const mediaType of Object.values(response.content)) {
                if (mediaType.schema?.$ref) {
                  checkRef(
                    mediaType.schema.$ref,
                    `${path}.${method}.responses.${status}`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Factory function to create generator with defaults
 */
export function createAPIContractGenerator(
  config?: APIContractGeneratorConfig,
): APIContractGenerator {
  return new APIContractGenerator(config);
}
```

---

## Pass Criteria

### Must Pass

1. **PC-1: APIContractGenerator Class Exists**
   - File exists at `agents/architect/generators/api-contract-generator.ts`
   - Exports `APIContractGenerator` class
   - Exports `createAPIContractGenerator` factory function
   - TypeScript compilation succeeds with no errors

2. **PC-2: generateSpec() Method**
   - Method signature: `async generateSpec(requirements: APIRequirements): Promise<OpenAPISpec>`
   - Returns valid OpenAPISpec object
   - Includes `openapi: "3.0.3"` version
   - Includes `info`, `paths` sections
   - Handles empty endpoints gracefully

3. **PC-3: Valid OpenAPI 3.0 YAML Output**
   - `generateYAML(spec)` method exists
   - Outputs valid YAML string
   - YAML passes `swagger-cli validate` with zero errors
   - YAML is properly indented and human-readable
   - Contains all standard OpenAPI sections

4. **PC-4: Paths and Schemas Generation**
   - Generates `paths` object with all endpoints
   - Each operation has: operationId, summary, responses
   - Generates `components.schemas` for reusable types
   - Schemas include: type, properties, required fields
   - Proper HTTP status codes: 200, 400, 401, 404, 500

5. **PC-5: Security Definitions**
   - Generates `components.securitySchemes` section
   - Supports JWT: `type: http, scheme: bearer, bearerFormat: JWT`
   - Supports API Key: `type: apiKey, in: header|query, name`
   - Supports OAuth2: `type: oauth2, flows`
   - Security requirements applied to operations

6. **PC-6: Request/Response Examples**
   - Each endpoint includes request example (if POST/PUT/PATCH)
   - Each response includes example for status code
   - Examples match schema structure
   - Realistic values generated based on field names
   - Examples include all required fields

7. **PC-7: HTTP Status Codes**
   - Success responses: 200 (OK), 201 (Created), 204 (No Content)
   - Client errors: 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)
   - Server errors: 500 (Internal Server Error)
   - Each status code has description
   - Error responses include error schema

8. **PC-8: Validation Integration**
   - `validate(yaml)` method exists
   - Returns `ValidationResult` with `valid`, `errors`, `warnings`
   - Detects missing required fields
   - Validates security scheme references
   - Provides helpful error messages with paths

### Should Pass

- **PC-9: Type Safety** - All types exported from `types.ts`, no `any` types in public APIs
- **PC-10: Versioning Support** - Info object includes `version`, servers support versioned URLs
- **PC-11: Documentation** - All classes and methods have JSDoc comments
- **PC-12: Error Handling** - Methods throw descriptive errors for invalid inputs

### Nice to Have

- **PC-13: Natural Language Parsing** - `parseRequirements(text)` uses LLM to parse natural language
- **PC-14: Schema Extraction** - Extract common schemas to `components.schemas` with `$ref` usage
- **PC-15: Advanced Validation** - Integration with actual `swagger-cli` for validation

---

## Dependencies

### Required

- **js-yaml** - YAML parsing and serialization (already in project)
- **uuid** - UUID generation for examples (already in project)
- Architect Agent types (`agents/architect/types.ts`) - EXISTS ✅
- TypeScript compiler - EXISTS ✅

### Optional

- **swagger-cli** - OpenAPI validation (install: `npm install -D swagger-cli`)
- **openapi-types** - TypeScript types for OpenAPI 3.0 (install: `npm install -D openapi-types`)

### Blocked By

- None (can be implemented independently)

---

## Implementation Notes

### File Creation Order

1. Create `generators/types.ts` with all TypeScript interfaces
2. Create `generators/api-contract-generator.ts` with main class
3. Create `generators/index.ts` to export public APIs
4. Add tests in `tests/unit/agents/architect/api-contract-generator.test.ts`
5. Integrate with Architect Agent's `generateAPIContract()` method

### OpenAPI 3.0 Specification

Reference: https://swagger.io/specification/

Key sections:

- **openapi**: Version string (must be "3.0.x")
- **info**: Metadata about the API
- **servers**: API server URLs
- **paths**: Available endpoints and operations
- **components**: Reusable schemas, parameters, responses, security schemes
- **security**: Global security requirements
- **tags**: Grouping and organization

### Example Value Generation Strategy

Use field name patterns to infer realistic values:

- `*id`, `*uuid` → UUID v4
- `*email` → `user@example.com`
- `*name` → Context-appropriate name
- `*_at`, `*date`, `*time` → ISO 8601 timestamp
- `*url`, `*link` → Valid URL
- `*count`, `*total` → Positive integer
- `*price`, `*amount` → Decimal number

### Validation Strategy

Phase 1: Internal validation (check required fields, refs)
Phase 2: Integrate swagger-cli for full validation
Phase 3: Schema-level validation for examples

### Integration with Architect Agent

```typescript
// In architect-agent.ts
async generateAPIContract(requirements: string): Promise<APIContract> {
  const generator = new APIContractGenerator();
  const apiReqs = await this.parseAPIRequirements(requirements);
  const spec = await generator.generateSpec(apiReqs);
  const yaml = generator.generateYAML(spec);

  const validation = await generator.validate(yaml);
  if (!validation.valid) {
    throw new Error(`Invalid OpenAPI spec: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  return {
    id: uuid(),
    name: apiReqs.title,
    type: 'rest',
    version: apiReqs.version,
    spec: yaml,
    endpoints: apiReqs.endpoints,
  };
}
```

---

## Future Enhancements

### Phase 2 Additions (Post-MVP)

- **GraphQL Schema Generation** - Generate GraphQL SDL from requirements
- **gRPC Proto Generation** - Generate Protocol Buffer definitions
- **Postman Collection Export** - Convert OpenAPI to Postman collection
- **Code Generation** - Generate client SDKs from OpenAPI spec
- **Mock Server** - Generate mock API server from spec

### Advanced Features

- **AI-Powered Parsing** - Use LLM to parse natural language requirements
- **Schema Inference** - Automatically infer schemas from example data
- **Versioning Strategy** - Automated version bumping and changelog
- **Breaking Change Detection** - Identify breaking changes between versions
- **Performance Annotations** - Add caching, rate limiting metadata

### Integration Points

- **Architect Agent** - Use generator in `generateAPIContract()` method
- **Build Agent** - Generate API implementation stubs from spec
- **QA Agent** - Validate implementation matches spec
- **Frontend Team** - Generate TypeScript types from spec

---

## Success Metrics

### Implementation Success

- All 8 "Must Pass" criteria verified ✅
- TypeScript compilation clean with no errors ✅
- Generated YAML passes `swagger-cli validate` ✅
- Examples are realistic and match schemas ✅
- Security definitions are complete ✅

### Usage Success (Post-Implementation)

- Architect Agent successfully generates API contracts from requirements
- Generated OpenAPI specs are used in development workflow
- Developers report time savings from automated spec generation
- API documentation is always up-to-date with specs

---

## References

### Related Tasks

- VIBE-P10-001: Architect Agent Base (uses APIContract interface)
- VIBE-P10-002: Architecture Template System (API templates)
- VIBE-P10-003: Tech Stack Decision Tree (API framework choices)

### Similar Patterns in Codebase

- `agents/specification/task-generator.ts` - Generator pattern example
- `agents/architect/types.ts` - APIContract interface (lines 89-101)
- `agents/architect/prompts.ts` - API_CONTRACT_PROMPT (lines 120-158)

### External References

- OpenAPI 3.0 Specification: https://swagger.io/specification/
- OpenAPI Examples: https://github.com/OAI/OpenAPI-Specification/tree/main/examples
- swagger-cli: https://github.com/APIDevTools/swagger-cli
- js-yaml: https://github.com/nodeca/js-yaml
- API Design Best Practices: https://swagger.io/resources/articles/best-practices-in-api-design/
