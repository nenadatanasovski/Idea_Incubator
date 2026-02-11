/**
 * Backend Endpoint Generator Module (VIBE-P13-003)
 *
 * Generates Express.js route handlers from API specifications.
 * Includes validation middleware, TypeScript types, and OpenAPI documentation.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ApiSpec {
  /** Endpoint path (e.g., "/api/ideas/:slug") */
  path: string;
  /** HTTP method */
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Route description for documentation */
  description?: string;
  /** Request body schema (for POST/PUT/PATCH) */
  requestBody?: SchemaDefinition;
  /** Request query parameters */
  queryParams?: Record<string, ParamDefinition>;
  /** Request path parameters */
  pathParams?: Record<string, ParamDefinition>;
  /** Response schema */
  responseBody: SchemaDefinition;
  /** Authentication required? */
  requiresAuth?: boolean;
  /** Status codes and meanings */
  statusCodes?: Record<number, string>;
}

export interface SchemaDefinition {
  /** TypeScript type name */
  typeName: string;
  /** Field definitions */
  fields: Record<string, FieldDefinition>;
}

export interface FieldDefinition {
  /** TypeScript type */
  type: string;
  /** Is field required? */
  required: boolean;
  /** Validation rules */
  validation?: ValidationRule[];
  /** Field description */
  description?: string;
}

export interface ParamDefinition {
  type: "string" | "number" | "boolean";
  required: boolean;
  description?: string;
}

export interface ValidationRule {
  type:
    | "minLength"
    | "maxLength"
    | "pattern"
    | "min"
    | "max"
    | "email"
    | "url"
    | "custom";
  value?: any;
  message?: string;
}

export interface GeneratedCode {
  /** Route handler code */
  routeHandler: string;
  /** TypeScript type definitions */
  typeDefinitions: string;
  /** Validation middleware code */
  validationMiddleware: string;
  /** OpenAPI documentation */
  openApiDoc: string;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate complete Express route handler from API spec
 */
export function generateBackendEndpoint(spec: ApiSpec): GeneratedCode {
  return {
    routeHandler: generateRouteHandler(spec),
    typeDefinitions: generateTypeDefinitions(spec),
    validationMiddleware: generateValidationMiddleware(spec),
    openApiDoc: generateOpenApiDoc(spec),
  };
}

// ============================================================================
// ROUTE HANDLER GENERATION
// ============================================================================

function generateRouteHandler(spec: ApiSpec): string {
  const { path, method, description, requiresAuth } = spec;
  const handlerName = generateHandlerName(path, method);
  const validationMiddlewareName = `validate${capitalize(handlerName)}`;

  // Build middleware chain
  const middlewares: string[] = [];
  if (requiresAuth) {
    middlewares.push("authMiddleware");
  }
  middlewares.push(validationMiddlewareName);

  const middlewareChain =
    middlewares.length > 0 ? middlewares.map((m) => `  ${m},\n`).join("") : "";

  // Generate handler body based on method
  const handlerBody = generateHandlerBody(spec);

  return `/**
 * ${description || `${method.toUpperCase()} ${path}`}
 */
router.${method}(
  "${path}",
${middlewareChain}  asyncHandler(async (req, res) => {
${handlerBody}
  })
);
`;
}

function generateHandlerBody(spec: ApiSpec): string {
  const { method, requestBody, queryParams, pathParams, responseBody } = spec;

  let body = "";

  // Extract parameters
  if (pathParams) {
    const paramNames = Object.keys(pathParams);
    body += `    const { ${paramNames.join(", ")} } = req.params;\n`;
  }

  if (queryParams) {
    const queryNames = Object.keys(queryParams);
    body += `    const { ${queryNames.join(", ")} } = req.query;\n`;
  }

  if (requestBody && ["post", "put", "patch"].includes(method)) {
    body += `    const data: ${requestBody.typeName} = req.body;\n`;
  }

  body += "\n";

  // Add database operation placeholder
  body += `    // TODO: Implement ${method.toUpperCase()} logic\n`;
  body += `    // Example: const result = await query<${responseBody.typeName}>(...)\n\n`;

  // Response
  body += `    respond(res, result);\n`;

  return body;
}

function generateHandlerName(path: string, method: string): string {
  // Convert /api/ideas/:slug to getIdeasBySlug
  const parts = path.split("/").filter((p) => p && p !== "api");
  const resource = parts[0] || "resource";
  const hasParam = path.includes(":");

  if (hasParam) {
    return `${method}${capitalize(resource)}ByParam`;
  }

  return `${method}${capitalize(resource)}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// TYPE DEFINITIONS GENERATION
// ============================================================================

function generateTypeDefinitions(spec: ApiSpec): string {
  const types: string[] = [];

  // Request body type
  if (spec.requestBody) {
    types.push(generateInterfaceDefinition(spec.requestBody));
  }

  // Response body type
  types.push(generateInterfaceDefinition(spec.responseBody));

  // Query params type
  if (spec.queryParams && Object.keys(spec.queryParams).length > 0) {
    types.push(generateQueryParamsType(spec.queryParams));
  }

  return types.join("\n\n");
}

function generateInterfaceDefinition(schema: SchemaDefinition): string {
  const { typeName, fields } = schema;

  let code = `export interface ${typeName} {\n`;

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    if (fieldDef.description) {
      code += `  /** ${fieldDef.description} */\n`;
    }
    const optional = fieldDef.required ? "" : "?";
    code += `  ${fieldName}${optional}: ${fieldDef.type};\n`;
  }

  code += "}";

  return code;
}

function generateQueryParamsType(
  params: Record<string, ParamDefinition>,
): string {
  let code = `export interface QueryParams {\n`;

  for (const [paramName, paramDef] of Object.entries(params)) {
    if (paramDef.description) {
      code += `  /** ${paramDef.description} */\n`;
    }
    const optional = paramDef.required ? "" : "?";
    code += `  ${paramName}${optional}: ${paramDef.type};\n`;
  }

  code += "}";

  return code;
}

// ============================================================================
// VALIDATION MIDDLEWARE GENERATION
// ============================================================================

function generateValidationMiddleware(spec: ApiSpec): string {
  const handlerName = generateHandlerName(spec.path, spec.method);
  const middlewareName = `validate${capitalize(handlerName)}`;

  const validators: string[] = [];

  // Path params validation
  if (spec.pathParams) {
    for (const [name, def] of Object.entries(spec.pathParams)) {
      validators.push(generateParamValidator(name, def, "params"));
    }
  }

  // Query params validation
  if (spec.queryParams) {
    for (const [name, def] of Object.entries(spec.queryParams)) {
      validators.push(generateParamValidator(name, def, "query"));
    }
  }

  // Request body validation
  if (spec.requestBody) {
    validators.push(generateBodyValidator(spec.requestBody));
  }

  if (validators.length === 0) {
    return `// No validation needed for ${spec.path}`;
  }

  return `/**
 * Validation middleware for ${spec.path}
 */
export const ${middlewareName} = (req: Request, res: Response, next: NextFunction) => {
  const errors: string[] = [];

${validators.map((v) => `  ${v}`).join("\n\n")}

  if (errors.length > 0) {
    res.status(400).json({ success: false, error: errors.join('; ') });
    return;
  }

  next();
};
`;
}

function generateParamValidator(
  name: string,
  def: ParamDefinition,
  location: "params" | "query",
): string {
  let code = `// Validate ${location}.${name}\n`;

  if (def.required) {
    code += `  if (!req.${location}.${name}) {\n`;
    code += `    errors.push('${name} is required');\n`;
    code += `  }\n`;
  }

  // Type validation
  if (def.type === "number") {
    code += `  if (req.${location}.${name} && isNaN(Number(req.${location}.${name}))) {\n`;
    code += `    errors.push('${name} must be a number');\n`;
    code += `  }\n`;
  } else if (def.type === "boolean") {
    code += `  if (req.${location}.${name} && !['true', 'false'].includes(String(req.${location}.${name}))) {\n`;
    code += `    errors.push('${name} must be a boolean');\n`;
    code += `  }\n`;
  }

  return code;
}

function generateBodyValidator(schema: SchemaDefinition): string {
  let code = `// Validate request body\n`;
  code += `  if (!req.body) {\n`;
  code += `    errors.push('Request body is required');\n`;
  code += `    return;\n`;
  code += `  }\n\n`;

  for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
    if (fieldDef.required) {
      code += `  if (req.body.${fieldName} === undefined || req.body.${fieldName} === null) {\n`;
      code += `    errors.push('${fieldName} is required');\n`;
      code += `  }\n`;
    }

    // Apply validation rules
    if (fieldDef.validation) {
      for (const rule of fieldDef.validation) {
        code += generateValidationRule(fieldName, rule);
      }
    }
  }

  return code;
}

function generateValidationRule(
  fieldName: string,
  rule: ValidationRule,
): string {
  let code = "";

  switch (rule.type) {
    case "minLength":
      code += `  if (req.body.${fieldName} && req.body.${fieldName}.length < ${rule.value}) {\n`;
      code += `    errors.push('${rule.message || `${fieldName} must be at least ${rule.value} characters`}');\n`;
      code += `  }\n`;
      break;

    case "maxLength":
      code += `  if (req.body.${fieldName} && req.body.${fieldName}.length > ${rule.value}) {\n`;
      code += `    errors.push('${rule.message || `${fieldName} must be at most ${rule.value} characters`}');\n`;
      code += `  }\n`;
      break;

    case "pattern":
      code += `  if (req.body.${fieldName} && !/${rule.value}/.test(req.body.${fieldName})) {\n`;
      code += `    errors.push('${rule.message || `${fieldName} format is invalid`}');\n`;
      code += `  }\n`;
      break;

    case "email":
      code += `  if (req.body.${fieldName} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(req.body.${fieldName})) {\n`;
      code += `    errors.push('${rule.message || `${fieldName} must be a valid email`}');\n`;
      code += `  }\n`;
      break;

    case "min":
      code += `  if (req.body.${fieldName} !== undefined && req.body.${fieldName} < ${rule.value}) {\n`;
      code += `    errors.push('${rule.message || `${fieldName} must be at least ${rule.value}`}');\n`;
      code += `  }\n`;
      break;

    case "max":
      code += `  if (req.body.${fieldName} !== undefined && req.body.${fieldName} > ${rule.value}) {\n`;
      code += `    errors.push('${rule.message || `${fieldName} must be at most ${rule.value}`}');\n`;
      code += `  }\n`;
      break;
  }

  return code;
}

// ============================================================================
// OPENAPI DOCUMENTATION GENERATION
// ============================================================================

function generateOpenApiDoc(spec: ApiSpec): string {
  const { path, method, description, requestBody, responseBody, statusCodes } =
    spec;

  const doc: any = {
    summary: description || `${method.toUpperCase()} ${path}`,
    description: description,
    parameters: [],
    responses: {},
  };

  // Add path parameters
  if (spec.pathParams) {
    for (const [name, def] of Object.entries(spec.pathParams)) {
      doc.parameters.push({
        name,
        in: "path",
        required: def.required,
        description: def.description,
        schema: { type: def.type },
      });
    }
  }

  // Add query parameters
  if (spec.queryParams) {
    for (const [name, def] of Object.entries(spec.queryParams)) {
      doc.parameters.push({
        name,
        in: "query",
        required: def.required,
        description: def.description,
        schema: { type: def.type },
      });
    }
  }

  // Add request body
  if (requestBody && ["post", "put", "patch"].includes(method)) {
    doc.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: {
            $ref: `#/components/schemas/${requestBody.typeName}`,
          },
        },
      },
    };
  }

  // Add responses
  const successCode = method === "post" ? 201 : 200;
  doc.responses[successCode] = {
    description: statusCodes?.[successCode] || "Success",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: `#/components/schemas/${responseBody.typeName}` },
          },
        },
      },
    },
  };

  // Add error responses
  if (statusCodes) {
    for (const [code, message] of Object.entries(statusCodes)) {
      const statusCode = Number(code);
      if (statusCode >= 400) {
        doc.responses[statusCode] = {
          description: message,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  error: { type: "string" },
                },
              },
            },
          },
        };
      }
    }
  }

  return `/**
 * @openapi
 * ${path}:
 *   ${method}:
${JSON.stringify(doc, null, 4)
  .split("\n")
  .map((line) => ` *     ${line}`)
  .join("\n")}
 */`;
}

// ============================================================================
// INTEGRATION WITH EXISTING CODEBASE
// ============================================================================

/**
 * Integrate generated route into existing router file
 */
export function integrateRoute(
  existingRouterCode: string,
  generatedCode: GeneratedCode,
  _spec: ApiSpec,
): string {
  // Find the end of imports section
  const importEndIndex = findImportSectionEnd(existingRouterCode);

  // Insert type definitions after imports
  let code = existingRouterCode.slice(0, importEndIndex);
  code += "\n// ============ Generated Types ============\n\n";
  code += generatedCode.typeDefinitions;
  code += "\n\n";

  // Find validation middleware section or create it
  const middlewareIndex = findOrCreateMiddlewareSection(existingRouterCode);
  code += existingRouterCode.slice(importEndIndex, middlewareIndex);
  code += "\n// ============ Generated Validation ============\n\n";
  code += generatedCode.validationMiddleware;
  code += "\n\n";

  // Find routes section and add route
  const routesEndIndex = findRouteSectionEnd(existingRouterCode);
  code += existingRouterCode.slice(middlewareIndex, routesEndIndex);
  code += "\n// ============ Generated Route ============\n\n";
  code += generatedCode.openApiDoc;
  code += "\n";
  code += generatedCode.routeHandler;
  code += "\n";
  code += existingRouterCode.slice(routesEndIndex);

  return code;
}

function findImportSectionEnd(code: string): number {
  const lines = code.split("\n");
  let lastImportIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("import ")) {
      lastImportIndex = i;
    } else if (lastImportIndex > 0 && lines[i].trim() === "") {
      return (
        code.indexOf(lines[lastImportIndex]) + lines[lastImportIndex].length + 1
      );
    }
  }

  return 0;
}

function findOrCreateMiddlewareSection(code: string): number {
  const middlewareMarker = "// Middleware";
  const index = code.indexOf(middlewareMarker);
  return index > 0 ? index : code.indexOf("const router");
}

function findRouteSectionEnd(code: string): number {
  const exportIndex = code.lastIndexOf("export default router");
  return exportIndex > 0 ? exportIndex : code.length;
}
