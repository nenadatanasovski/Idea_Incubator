# VIBE-P10-002: Architecture Template System - Implementation Specification

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Priority:** P1 (Phase 10 - Architecture Agent Foundation)
**Effort:** Medium (12-16 hours)
**Model:** Opus
**Agent Type:** build_agent

---

## Overview

Build a comprehensive template system for common architecture patterns that provides structured, reusable blueprints for different application types. The Architect Agent will use these templates to quickly scaffold consistent, best-practice architectures for web apps, mobile apps, APIs, and monolithic applications.

### Problem Statement

**Current State:**
- Architect Agent base implementation exists (`agents/architect/architect-agent.ts`)
- Agent types and prompts defined (`agents/architect/types.ts`, `agents/architect/prompts.ts`)
- **NO templates directory exists** (`agents/architect/templates/` does not exist)
- Architect Agent must create architecture recommendations from scratch
- No standardized patterns for common application types
- Risk of inconsistent architecture decisions across similar projects

**Desired State:**
- Template library with 4+ common architecture patterns
- Templates directory at `agents/architect/templates/`
- Each template includes: folder structure, recommended packages, config files, deployment considerations
- Templates are TypeScript-structured and type-safe
- Architect Agent can select and customize templates based on project requirements
- Templates encode best practices for each architecture type

### Value Proposition

The Architecture Template System is the **"Blueprint Library"** that enables:

1. **Rapid Architecture Generation** - Start from proven patterns instead of blank slate
2. **Consistency Across Projects** - Same architecture type = same structure
3. **Best Practices Encoded** - Templates include battle-tested package choices
4. **Reduced Decision Fatigue** - Pre-selected tech stacks for common scenarios
5. **Extensibility** - New templates can be added as patterns emerge
6. **Knowledge Preservation** - Templates capture architectural decisions and rationale

---

## Requirements

### Functional Requirements

#### 1. Template Directory Structure

**FR-1.1: Create Templates Directory**
- Create directory at `agents/architect/templates/`
- Each template is a separate TypeScript file: `{type}-template.ts`
- Templates export structured objects conforming to `ArchitectureTemplate` interface
- Index file (`index.ts`) re-exports all templates for easy import

**FR-1.2: Template Type System**
- Create `types.ts` in templates directory with TypeScript interfaces
- Define `ArchitectureTemplate` interface with required keys:
  - `name`: Template name string
  - `description`: Brief description of architecture type
  - `type`: Template type (`'web' | 'mobile' | 'api' | 'monolith' | 'custom'`)
  - `folder_structure`: Nested object representing directory hierarchy
  - `packages`: Object with `core`, `dev`, and `optional` package arrays
  - `configs`: Array of configuration file objects
  - `deployment`: Deployment configuration object
  - `notes`: Array of implementation notes
  - `metadata`: Optional extensible metadata object

**FR-1.3: Package Information Interface**
```typescript
interface PackageInfo {
  name: string;
  version?: string;  // Optional pinned version
  reason: string;    // Why this package is recommended
}

interface PackageRecommendations {
  core: PackageInfo[];
  dev: PackageInfo[];
  optional: PackageInfo[];
}
```

**FR-1.4: Configuration File Interface**
```typescript
interface ConfigFile {
  filename: string;
  content: string;
  description: string;
}
```

**FR-1.5: Deployment Configuration Interface**
```typescript
interface DeploymentConfig {
  platform: string[];  // e.g., ["AWS", "Vercel", "Docker"]
  considerations: string[];
  scripts?: Record<string, string>;
  environmentVariables?: EnvironmentVariable[];
}

interface EnvironmentVariable {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}
```

#### 2. WebAppTemplate - React/Next.js Frontend + API Backend

**FR-2.1: Web App Folder Structure**
```
frontend/
  ├── src/
  │   ├── components/
  │   ├── pages/
  │   ├── hooks/
  │   ├── services/
  │   ├── types/
  │   └── utils/
  ├── public/
  └── tests/
backend/
  ├── src/
  │   ├── api/
  │   ├── services/
  │   ├── models/
  │   ├── middleware/
  │   └── utils/
  └── tests/
shared/
  └── types/
```

**FR-2.2: Web App Core Packages**
- Frontend: `react`, `react-dom`, `next`, `typescript`, `tailwindcss`
- Backend: `express`, `typescript`, `cors`, `helmet`
- Dev: `vite`, `eslint`, `prettier`, `vitest`
- Optional: `react-query`, `zustand`, `zod`, `axios`

**FR-2.3: Web App Configuration Files**
- `tsconfig.json` (TypeScript config for frontend/backend)
- `tailwind.config.js` (Tailwind CSS configuration)
- `vite.config.ts` or `next.config.js` (Build tool config)
- `.eslintrc.json` (Linting rules)

**FR-2.4: Web App Deployment**
- Platforms: Vercel, AWS, Docker
- Considerations: Frontend CDN deployment, backend containerization, managed databases
- Environment variables: `DATABASE_URL`, `API_URL`, `JWT_SECRET`

#### 3. MobileAppTemplate - React Native/Expo

**FR-3.1: Mobile App Folder Structure**
```
src/
  ├── components/
  ├── screens/
  ├── navigation/
  ├── hooks/
  ├── services/
  ├── store/
  ├── types/
  └── utils/
assets/
  ├── images/
  └── fonts/
tests/
```

**FR-3.2: Mobile App Core Packages**
- Core: `react-native`, `expo`, `typescript`, `react-navigation`
- State: `zustand` or `redux-toolkit`
- Offline: `@react-native-async-storage/async-storage`, `react-query` (with persistence)
- Dev: `expo-cli`, `metro`, `jest`, `detox`

**FR-3.3: Mobile App Offline-First Patterns**
- Local database options: SQLite, Realm, WatermelonDB
- Background sync patterns
- Offline queue for API requests
- Push notification setup

**FR-3.4: Mobile App Deployment**
- Expo EAS Build configuration
- App Store / Play Store submission considerations
- Over-the-air (OTA) updates setup
- Environment configuration (dev/staging/production)

#### 4. APITemplate - REST/GraphQL Microservices

**FR-4.1: API Folder Structure**
```
src/
  ├── api/
  │   ├── routes/
  │   ├── controllers/
  │   └── validators/
  ├── graphql/ (optional)
  │   ├── schema/
  │   ├── resolvers/
  │   └── types/
  ├── services/
  ├── models/
  ├── middleware/
  ├── database/
  │   └── migrations/
  ├── utils/
  └── types/
tests/
  ├── unit/
  ├── integration/
  └── e2e/
```

**FR-4.2: API Core Packages**
- REST: `express`, `fastify`, or `koa`
- GraphQL: `apollo-server` or `graphql-yoga` (optional)
- Database: `drizzle-orm`, `prisma`, or `typeorm`
- Validation: `zod`, `joi`, or `yup`
- Auth: `passport`, `jsonwebtoken`
- Dev: `nodemon`, `ts-node`, `supertest`

**FR-4.3: API Architecture Variants**
- Support both REST and GraphQL variants
- Monolithic API vs. microservices structure options
- Database abstraction layer considerations
- Authentication/authorization patterns (JWT, OAuth2, API keys)

**FR-4.4: API Deployment**
- Container setup (Dockerfile)
- Kubernetes manifest examples
- API Gateway integration patterns
- Logging and monitoring setup (Winston, Pino)

#### 5. MonolithTemplate - Traditional Server-Rendered Apps

**FR-5.1: Monolith Folder Structure**
```
src/
  ├── controllers/
  ├── views/
  │   ├── layouts/
  │   └── partials/
  ├── models/
  ├── routes/
  ├── middleware/
  ├── services/
  ├── public/
  │   ├── css/
  │   ├── js/
  │   └── images/
  └── utils/
tests/
config/
```

**FR-5.2: Monolith Core Packages**
- Framework: `express` + `ejs`/`pug`, or `next.js` with SSR
- Database: Same as API template options
- Frontend: Minimal JS, optional `htmx` or `alpine.js`
- Session: `express-session`, `connect-redis`
- Dev: `nodemon`, `concurrently`

**FR-5.3: Monolith Patterns**
- Server-side rendering (SSR) setup
- Session-based authentication
- Traditional MVC structure
- Asset pipeline considerations
- Template engine configuration

**FR-5.4: Monolith Deployment**
- Single container deployment
- Process managers (PM2, systemd)
- CDN for static assets
- Database backup strategies
- Reverse proxy setup (nginx, caddy)

### Non-Functional Requirements

**NFR-1: Type Safety**
- All templates must be strongly typed with TypeScript
- Export interfaces for all template structures
- No `any` types in template definitions
- Templates conform to `ArchitectureTemplate` interface

**NFR-2: Extensibility**
- New templates can be added without modifying existing code
- Template interface supports arbitrary metadata fields
- Templates can be composed (future enhancement)
- Template validation can be added independently

**NFR-3: Documentation**
- Each template includes inline JSDoc comments
- `notes` field explains architectural decisions
- Package reasons explain why each package is recommended
- Deployment considerations provide actionable guidance

**NFR-4: Consistency**
- All templates follow same structural pattern
- Package recommendation format consistent across templates
- Configuration file format standardized
- Deployment considerations format standardized

---

## Technical Design

### File Structure

```
agents/architect/templates/
├── index.ts                  # Re-exports all templates
├── types.ts                  # TypeScript interfaces for templates
├── web-app-template.ts       # WebAppTemplate
├── mobile-app-template.ts    # MobileAppTemplate
├── api-template.ts           # APITemplate
└── monolith-template.ts      # MonolithTemplate
```

### Type Definitions

**File:** `agents/architect/templates/types.ts`

```typescript
/**
 * Architecture template - blueprint for common architecture patterns
 */
export interface ArchitectureTemplate {
  name: string;
  description: string;
  type: 'web' | 'mobile' | 'api' | 'monolith' | 'custom';
  folder_structure: FolderStructure;
  packages: PackageRecommendations;
  configs: ConfigFile[];
  deployment: DeploymentConfig;
  notes: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Folder structure - nested object representing directory hierarchy
 * null values represent leaf directories
 */
export interface FolderStructure {
  [key: string]: FolderStructure | null;
}

/**
 * Package recommendations categorized by usage
 */
export interface PackageRecommendations {
  core: PackageInfo[];
  dev: PackageInfo[];
  optional: PackageInfo[];
}

/**
 * Package information with rationale
 */
export interface PackageInfo {
  name: string;
  version?: string;
  reason: string;
}

/**
 * Configuration file with content and description
 */
export interface ConfigFile {
  filename: string;
  content: string;
  description: string;
}

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  platform: string[];
  considerations: string[];
  scripts?: Record<string, string>;
  environmentVariables?: EnvironmentVariable[];
}

/**
 * Environment variable specification
 */
export interface EnvironmentVariable {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}
```

### Template Implementation Example

**File:** `agents/architect/templates/web-app-template.ts`

```typescript
import type { ArchitectureTemplate } from './types.js';

/**
 * Web Application Template
 * React/Next.js frontend with Express/Fastify API backend
 */
export const webAppTemplate: ArchitectureTemplate = {
  name: 'Web Application',
  description: 'Modern web application with React/Next.js frontend and Express API backend',
  type: 'web',

  folder_structure: {
    frontend: {
      src: {
        components: null,
        pages: null,
        hooks: null,
        services: null,
        types: null,
        utils: null,
      },
      public: null,
      tests: null,
    },
    backend: {
      src: {
        api: null,
        services: null,
        models: null,
        middleware: null,
        utils: null,
      },
      tests: null,
    },
    shared: {
      types: null,
    },
  },

  packages: {
    core: [
      { name: 'react', reason: 'Component-based UI library with excellent ecosystem' },
      { name: 'react-dom', reason: 'React DOM rendering for web applications' },
      { name: 'next', reason: 'React framework with SSR, routing, and API routes' },
      { name: 'typescript', reason: 'Type safety across frontend and backend code' },
      { name: 'tailwindcss', reason: 'Utility-first CSS framework for rapid styling' },
      { name: 'express', reason: 'Fast, minimal backend framework with middleware ecosystem' },
      { name: 'cors', reason: 'Enable CORS for API endpoints' },
      { name: 'helmet', reason: 'Security middleware for Express apps' },
    ],
    dev: [
      { name: 'vite', reason: 'Fast development server and build tool' },
      { name: 'eslint', reason: 'Code linting for quality and consistency' },
      { name: 'prettier', reason: 'Code formatting for consistent style' },
      { name: 'vitest', reason: 'Fast unit testing compatible with Vite' },
      { name: '@types/express', reason: 'TypeScript types for Express' },
      { name: '@types/node', reason: 'TypeScript types for Node.js' },
    ],
    optional: [
      { name: 'react-query', reason: 'Server state management and caching' },
      { name: 'zustand', reason: 'Lightweight client state management' },
      { name: 'zod', reason: 'Runtime type validation and schema definition' },
      { name: 'axios', reason: 'Promise-based HTTP client for API calls' },
      { name: 'drizzle-orm', reason: 'Type-safe ORM for database operations' },
    ],
  },

  configs: [
    {
      filename: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          lib: ['ES2022', 'DOM'],
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
        },
        include: ['src'],
        exclude: ['node_modules'],
      }, null, 2),
      description: 'TypeScript configuration for modern ES modules with strict type checking',
    },
    {
      filename: 'tailwind.config.js',
      content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};`,
      description: 'Tailwind CSS configuration with content paths',
    },
    {
      filename: 'vite.config.ts',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});`,
      description: 'Vite configuration with React plugin and API proxy',
    },
  ],

  deployment: {
    platform: ['Vercel', 'AWS', 'Docker', 'Cloudflare Pages'],
    considerations: [
      'Frontend: Deploy to CDN or edge network (Vercel, Cloudflare Pages)',
      'Backend: Containerize with Docker, deploy to AWS ECS, Kubernetes, or serverless',
      'Database: Use managed services (AWS RDS, PlanetScale, Neon)',
      'Environment variables: Use platform-specific secret management',
      'CI/CD: GitHub Actions or GitLab CI for automated deployments',
      'Static assets: Serve from CDN with caching headers',
      'API rate limiting: Implement rate limiting in backend',
      'HTTPS: Ensure all traffic is encrypted',
    ],
    scripts: {
      'build:frontend': 'cd frontend && npm run build',
      'build:backend': 'cd backend && npm run build',
      'docker:build': 'docker build -t myapp-backend ./backend',
      'deploy:vercel': 'cd frontend && vercel deploy --prod',
    },
    environmentVariables: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL database connection string',
        required: true,
        example: 'postgresql://user:pass@host:5432/dbname',
      },
      {
        name: 'API_URL',
        description: 'Backend API base URL',
        required: true,
        example: 'https://api.example.com',
      },
      {
        name: 'JWT_SECRET',
        description: 'Secret for JWT token signing',
        required: true,
        example: 'your-256-bit-secret',
      },
      {
        name: 'CORS_ORIGIN',
        description: 'Allowed CORS origins',
        required: false,
        example: 'https://example.com,https://app.example.com',
      },
    ],
  },

  notes: [
    'Consider Next.js App Router for improved routing and layouts',
    'Use React Server Components for better performance',
    'Implement API routes in Next.js for simple backends',
    'Consider tRPC for end-to-end type safety between frontend and backend',
    'Use Turborepo for monorepo management if scaling',
    'Implement proper error boundaries in React components',
    'Add authentication middleware to backend routes',
    'Use environment-specific config files (dev, staging, production)',
  ],

  metadata: {
    complexity: 'medium',
    teamSize: '2-8 developers',
    timeToSetup: '2-4 hours',
  },
};
```

### Index File

**File:** `agents/architect/templates/index.ts`

```typescript
/**
 * Architecture Templates
 * Pre-built blueprints for common architecture patterns
 */

export { webAppTemplate } from './web-app-template.js';
export { mobileAppTemplate } from './mobile-app-template.js';
export { apiTemplate } from './api-template.js';
export { monolithTemplate } from './monolith-template.js';

export type {
  ArchitectureTemplate,
  FolderStructure,
  PackageRecommendations,
  PackageInfo,
  ConfigFile,
  DeploymentConfig,
  EnvironmentVariable,
} from './types.js';
```

---

## Pass Criteria

### Must Pass

1. **PC-1: Templates Directory Exists**
   - Directory exists at `agents/architect/templates/`
   - Contains at least 4 template files:
     - `web-app-template.ts`
     - `mobile-app-template.ts`
     - `api-template.ts`
     - `monolith-template.ts`
   - Contains `index.ts` that re-exports all templates
   - Contains `types.ts` with TypeScript interfaces

2. **PC-2: WebAppTemplate Complete**
   - File `web-app-template.ts` exports `webAppTemplate` constant
   - Contains `folder_structure` with `frontend/`, `backend/`, `shared/` directories
   - Contains `packages.core` array with React, Next.js, Express, TypeScript, Tailwind
   - Contains `packages.dev` array with Vite/build tools
   - Contains `packages.optional` array with state management, API client libraries
   - Contains at least 2 items in `configs` array (tsconfig.json, tailwind.config.js)
   - Contains `deployment` object with platform array and considerations
   - All fields conform to `ArchitectureTemplate` interface

3. **PC-3: MobileAppTemplate Complete**
   - File `mobile-app-template.ts` exports `mobileAppTemplate` constant
   - Contains `folder_structure` with `src/`, `assets/`, `tests/` directories
   - Contains `packages.core` with React Native, Expo, TypeScript, React Navigation
   - Includes offline-first patterns in `notes` or deployment considerations
   - Contains at least 1 config file (expo config or similar)
   - Type set to `'mobile'`

4. **PC-4: APITemplate Complete**
   - File `api-template.ts` exports `apiTemplate` constant
   - Contains `folder_structure` with `src/api/`, `src/services/`, `src/models/`, `tests/`
   - Contains `packages` with both REST framework options (Express, Fastify)
   - Optionally includes GraphQL packages (apollo-server)
   - Contains deployment configs for containerization
   - Includes authentication/authorization in notes
   - Type set to `'api'`

5. **PC-5: MonolithTemplate Complete**
   - File `monolith-template.ts` exports `monolithTemplate` constant
   - Contains `folder_structure` with MVC pattern (`controllers/`, `views/`, `models/`)
   - Contains `packages` for server-side rendering (Express + template engine)
   - Contains session-based authentication references in notes
   - Deployment considerations include single-container setup
   - Type set to `'monolith'`

6. **PC-6: Type Safety**
   - All templates conform to `ArchitectureTemplate` interface
   - TypeScript compilation succeeds with no errors: `tsc --noEmit`
   - No `any` types in template definitions
   - All required interface fields populated in each template

7. **PC-7: Export Structure Works**
   - `index.ts` exports all templates as named exports
   - Example: `export { webAppTemplate } from './web-app-template.js';`
   - Imports work correctly: `import { webAppTemplate } from './templates';`
   - Types are also exported from index

8. **PC-8: Template Content Quality**
   - Each template has at least 5 core packages with reasons
   - Each template has at least 3 dev packages
   - Each template has at least 2 config files
   - Each template has deployment considerations array with 5+ items
   - Each template has notes array with 3+ implementation tips
   - Package reasons are descriptive (not just package names)

### Should Pass

9. **PC-9: Documentation Comments**
   - Each template file has JSDoc comments explaining the template
   - Each interface in `types.ts` has documentation
   - Complex structures have inline comments

10. **PC-10: Consistent Formatting**
    - All templates use consistent property ordering
    - Package arrays formatted consistently
    - Config content properly formatted (JSON indented, JS readable)

---

## Dependencies

### Required
- TypeScript compiler (exists in project) ✅
- Architect Agent base (`agents/architect/architect-agent.ts`) ✅
- Architect Agent types (`agents/architect/types.ts`) ✅

### Optional
- None

### Blocked By
- None (can be implemented independently)

---

## Implementation Steps

### Step 1: Create Templates Directory and Types
1. Create directory: `agents/architect/templates/`
2. Create `types.ts` with all interfaces
3. Verify TypeScript compilation

### Step 2: Implement WebAppTemplate
1. Create `web-app-template.ts`
2. Define complete folder structure
3. Add all package recommendations with reasons
4. Add configuration files (tsconfig, tailwind, vite)
5. Add deployment configuration
6. Add implementation notes

### Step 3: Implement MobileAppTemplate
1. Create `mobile-app-template.ts`
2. Define mobile-specific folder structure
3. Add React Native/Expo packages
4. Add offline-first patterns
5. Add Expo configuration
6. Add deployment notes for app stores

### Step 4: Implement APITemplate
1. Create `api-template.ts`
2. Define API folder structure
3. Add REST and GraphQL package options
4. Add database and ORM recommendations
5. Add Dockerfile template
6. Add API deployment considerations

### Step 5: Implement MonolithTemplate
1. Create `monolith-template.ts`
2. Define MVC folder structure
3. Add SSR framework packages
4. Add session management packages
5. Add traditional deployment configs
6. Add monolith-specific notes

### Step 6: Create Index File
1. Create `index.ts`
2. Export all templates
3. Export all types
4. Verify imports work

### Step 7: Verification
1. Run TypeScript compilation: `tsc --noEmit`
2. Verify all 8 pass criteria
3. Test imports in architect-agent.ts

---

## Integration Notes

### Usage by Architect Agent

The Architect Agent will use templates like this:

```typescript
import {
  webAppTemplate,
  mobileAppTemplate,
  apiTemplate,
  monolithTemplate
} from './templates/index.js';

// Store templates in agent
this.templates = new Map([
  ['web', webAppTemplate],
  ['mobile', mobileAppTemplate],
  ['api', apiTemplate],
  ['monolith', monolithTemplate],
]);

// Select template based on analysis
const template = this.templates.get(analysisResult.projectType);
```

### Template Selection Logic

Templates should be selected based on:
1. **Explicit project type** in requirements
2. **Inferred type** from requirement keywords
3. **Tech stack preferences** mentioned
4. **Deployment constraints** specified

### Template Customization

After selection, templates can be customized:
- Add/remove packages based on specific requirements
- Modify folder structure for project needs
- Adjust configs for team preferences
- Enhance deployment strategy

---

## Future Enhancements

### Phase 2 Additions
- **Serverless Template** - AWS Lambda, Cloudflare Workers
- **Desktop App Template** - Electron, Tauri
- **CLI Tool Template** - Node.js CLI with Commander
- **Microservices Template** - Service mesh, event-driven

### Advanced Features
- Template composition (combine multiple templates)
- Template validation functions
- Template versioning
- Dynamic template generation with AI
- Community template marketplace

---

## Success Metrics

### Implementation Success
- ✅ All 8 "Must Pass" criteria verified
- ✅ TypeScript compilation clean (`tsc --noEmit`)
- ✅ Templates directory contains 4 template files
- ✅ Each template exports valid structured object
- ✅ Index file successfully re-exports all templates

### Quality Metrics
- Each template has comprehensive package recommendations
- Configuration files are complete and valid
- Deployment considerations are actionable
- Implementation notes provide valuable guidance

---

## References

### Related Specifications
- **VIBE-P10-001**: Architect Agent Base Implementation
- **Existing code**: `agents/architect/architect-agent.ts` (line 456: template Map initialization)
- **Existing code**: `agents/architect/types.ts` (comprehensive architecture types)

### External References
- React documentation: https://react.dev
- Next.js best practices: https://nextjs.org/docs
- React Native architecture: https://reactnative.dev
- Twelve-Factor App: https://12factor.net
- API design patterns: https://restfulapi.net

---

## Appendix: Template Structure Validation

Templates can be validated with this logic:

```typescript
function validateTemplate(template: ArchitectureTemplate): void {
  if (!template.name || !template.description) {
    throw new Error('Template must have name and description');
  }

  if (!template.type || !['web', 'mobile', 'api', 'monolith', 'custom'].includes(template.type)) {
    throw new Error('Template must have valid type');
  }

  if (!template.folder_structure || Object.keys(template.folder_structure).length === 0) {
    throw new Error('Template must define folder_structure');
  }

  if (!template.packages?.core || template.packages.core.length < 3) {
    throw new Error('Template must define at least 3 core packages');
  }

  if (!template.configs || template.configs.length < 1) {
    throw new Error('Template must define at least 1 config file');
  }

  if (!template.deployment?.platform || template.deployment.platform.length === 0) {
    throw new Error('Template must specify deployment platforms');
  }
}
```

---

**End of Specification**
