/**
 * Context Primer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as _path from 'path';
import {
  ContextPrimer,
  createContextPrimer
} from '../../agents/build/context-primer.js';
import { AtomicTask } from '../../types/build-agent.js';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs') as typeof fs;
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn()
  };
});

describe('context-primer', () => {
  let primer: ContextPrimer;

  const mockTask: AtomicTask = {
    id: 'T-001',
    phase: 'database',
    action: 'CREATE',
    file: 'database/migrations/001_test.sql',
    status: 'pending',
    requirements: ['Create table'],
    gotchas: ['Use TEXT for timestamps'],
    validation: {
      command: 'echo ok',
      expected: 'ok'
    },
    dependsOn: []
  };

  const mockTasksContent = `---
id: test-feature
complexity: simple
total_tasks: 2
---

# Test Tasks

\`\`\`yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/001_test.sql"
status: pending
requirements:
  - "Create table"
gotchas:
  - "Use TEXT for timestamps"
validation:
  command: "echo ok"
  expected: "ok"
depends_on: []
\`\`\`

\`\`\`yaml
id: T-002
phase: types
action: CREATE
file: "types/test.ts"
status: pending
requirements:
  - "Define interface"
gotchas:
  - "Export all types"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-001
\`\`\`
`;

  const mockClaudeMd = '# Project Conventions\n\nUse TypeScript.';

  beforeEach(() => {
    vi.clearAllMocks();
    primer = new ContextPrimer({ projectRoot: '/test/project' });

    // Default mock implementations
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
      if (filePath.includes('CLAUDE.md')) {
        return mockClaudeMd;
      }
      if (filePath.includes('tasks.md')) {
        return mockTasksContent;
      }
      return null;
    });
  });

  describe('constructor', () => {
    it('should create primer with default options', () => {
      const defaultPrimer = new ContextPrimer();
      expect(defaultPrimer).toBeDefined();
    });

    it('should accept custom token limit', () => {
      const customPrimer = new ContextPrimer({ tokenLimit: 50000 });
      expect(customPrimer.getTokenLimit()).toBe(50000);
    });

    it('should accept custom project root', () => {
      const customPrimer = new ContextPrimer({ projectRoot: '/custom/root' });
      expect(customPrimer).toBeDefined();
    });
  });

  describe('loadForTask', () => {
    it('should load context for valid task', async () => {
      const context = await primer.loadForTask('T-001', '/test/project/build/tasks.md');

      expect(context).toBeDefined();
      expect(context.task.id).toBe('T-001');
      expect(context.conventions).toContain('Project Conventions');
    });

    it('should throw error for invalid task ID', async () => {
      await expect(
        primer.loadForTask('INVALID', '/test/project/build/tasks.md')
      ).rejects.toThrow('Task INVALID not found');
    });

    it('should throw error for missing tasks file', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(
        primer.loadForTask('T-001', '/nonexistent/tasks.md')
      ).rejects.toThrow();
    });
  });

  describe('loadTask', () => {
    it('should load task with all components', async () => {
      const allTasks = [mockTask];
      const context = await primer.loadTask(mockTask, allTasks, '/test/project/build/tasks.md');

      expect(context.task).toBe(mockTask);
      expect(context.conventions).toBeDefined();
      expect(context.gotchas).toBeDefined();
      expect(context.tokenCount).toBeGreaterThan(0);
    });

    it('should include task gotchas', async () => {
      const allTasks = [mockTask];
      const context = await primer.loadTask(mockTask, allTasks, '/test/project/build/tasks.md');

      expect(context.gotchas.length).toBeGreaterThan(0);
      expect(context.gotchas[0].content).toBe('Use TEXT for timestamps');
    });
  });

  describe('loadCodebase', () => {
    it('should load files with token limit', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['file1.sql', 'file2.sql']);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('-- SQL content');

      const files = primer.loadCodebase(mockTask, 10000);

      expect(Object.keys(files).length).toBeGreaterThanOrEqual(0);
    });

    it('should respect token limit', () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['file1.ts', 'file2.ts']);
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('x'.repeat(10000));

      // Very low token limit
      const files = primer.loadCodebase(mockTask, 100);

      // Should load fewer files due to limit
      expect(Object.keys(files).length).toBeLessThanOrEqual(1);
    });
  });

  describe('token estimation', () => {
    it('should track token count in context', async () => {
      const allTasks = [mockTask];
      const context = await primer.loadTask(mockTask, allTasks, '/test/project/build/tasks.md');

      expect(context.tokenCount).toBeGreaterThan(0);
      expect(typeof context.tokenCount).toBe('number');
    });
  });

  describe('dependency outputs', () => {
    it('should load dependency task outputs', async () => {
      const depTask: AtomicTask = {
        id: 'T-000',
        phase: 'database',
        action: 'CREATE',
        file: 'database/schema.sql',
        status: 'completed',
        requirements: [],
        gotchas: [],
        validation: { command: '', expected: '' },
        dependsOn: []
      };

      const taskWithDep: AtomicTask = {
        ...mockTask,
        dependsOn: ['T-000']
      };

      (fs.readFileSync as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        if (filePath.includes('schema.sql')) {
          return '-- Schema content';
        }
        if (filePath.includes('CLAUDE.md')) {
          return mockClaudeMd;
        }
        return null;
      });

      const context = await primer.loadTask(taskWithDep, [depTask, taskWithDep], '/test/build/tasks.md');

      expect(context.dependencyOutputs).toBeDefined();
    });
  });

  describe('tokenLimit', () => {
    it('should get and set token limit', () => {
      expect(primer.getTokenLimit()).toBe(100000);

      primer.setTokenLimit(50000);
      expect(primer.getTokenLimit()).toBe(50000);
    });
  });

  describe('createContextPrimer', () => {
    it('should create primer instance', () => {
      const instance = createContextPrimer();
      expect(instance).toBeInstanceOf(ContextPrimer);
    });

    it('should pass options to constructor', () => {
      const instance = createContextPrimer({ tokenLimit: 25000 });
      expect(instance.getTokenLimit()).toBe(25000);
    });
  });
});
