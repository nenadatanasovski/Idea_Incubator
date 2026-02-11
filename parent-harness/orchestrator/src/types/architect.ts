/**
 * Architect Agent Type Definitions
 *
 * Types for architecture design tasks and outputs
 */

export interface ArchitectTaskPayload {
  requirements: string;
  constraints: string[];
  existingArchitecture?: string;
  outputFormat: "full" | "incremental";
}

export interface ArchitectOutput {
  taskId: string;
  generatedAt: string;
  components: Component[];
  techStack: TechStack;
  apiContracts?: APIContract[];
  databaseSchema?: Schema;
}

export interface Component {
  name: string;
  type: "frontend" | "backend" | "database" | "infrastructure";
  description: string;
  dependencies: string[];
}

export interface TechStack {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  infrastructure?: string[];
}

export interface APIContract {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  request?: Schema;
  response?: Schema;
}

export interface Schema {
  [key: string]: any;
}
