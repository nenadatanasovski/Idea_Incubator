/**
 * Task Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskGenerator,
  AtomicTask,
  Phase,
  TaskGeneratorOptions,
  GeneratedTasks
} from '../../agents/specification/task-generator.js';
import { ParsedBrief } from '../../agents/specification/brief-parser.js';
import { AnalyzedRequirements } from '../../agents/specification/prompts/tasks.js';
import { Gotcha } from '../../agents/specification/context-loader.js';

describe('task-generator', () => {
  let generator: TaskGenerator;
  let mockGotchas: Gotcha[];

  const mockBrief: ParsedBrief = {
    id: 'test-feature',
    title: 'Test Feature',
    complexity: 'simple',
    problem: 'Users need X',
    solution: 'Implement Y with database storage',
    mvpScope: {
      inScope: ['Feature A'],
      outOfScope: ['Feature B']
    },
    constraints: [],
    successCriteria: ['Works correctly'],
    rawContent: ''
  };

  const mockRequirements: AnalyzedRequirements = {
    functionalRequirements: [
      { id: 'FR-001', description: 'Store user data', priority: 'must' },
      { id: 'FR-002', description: 'Retrieve user data', priority: 'must' }
    ],
    nonFunctionalRequirements: [
      { category: 'performance', requirement: 'Fast queries', target: '<100ms' }
    ],
    constraints: ['SQLite only'],
    successCriteria: ['All tests pass'],
    ambiguities: []
  };

  beforeEach(() => {
    mockGotchas = [
      {
        id: 'G-001',
        content: 'Use TEXT for timestamps in SQLite',
        filePattern: '*.sql',
        actionType: 'CREATE',
        confidence: 'high',
        source: 'knowledge_base'
      },
      {
        id: 'G-002',
        content: 'Always export interfaces',
        filePattern: 'types/*.ts',
        actionType: 'CREATE',
        confidence: 'high',
        source: 'knowledge_base'
      },
      {
        id: 'G-003',
        content: 'Use parameterized queries',
        filePattern: 'database/*.ts',
        actionType: '*',
        confidence: 'high',
        source: 'knowledge_base'
      }
    ];

    generator = new TaskGenerator({
      gotchas: mockGotchas,
      migrationPrefix: 25
    });
  });

  describe('constructor', () => {
    it('should create generator with default options', () => {
      const defaultGenerator = new TaskGenerator({ gotchas: [] });
      expect(defaultGenerator).toBeDefined();
    });

    it('should accept custom migration prefix', () => {
      const customGenerator = new TaskGenerator({
        gotchas: [],
        migrationPrefix: 100
      });
      expect(customGenerator).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate tasks for simple brief', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      expect(result.tasks).toBeDefined();
      expect(result.tasks.length).toBeGreaterThanOrEqual(5);
      expect(result.tasks.length).toBeLessThanOrEqual(8);
      expect(result.totalCount).toBe(result.tasks.length);
    });

    it('should generate tasks in correct phase order', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const phaseOrder: Phase[] = ['database', 'types', 'queries', 'services', 'api', 'tests'];
      let lastPhaseIndex = -1;

      for (const task of result.tasks) {
        const currentPhaseIndex = phaseOrder.indexOf(task.phase);
        expect(currentPhaseIndex).toBeGreaterThanOrEqual(lastPhaseIndex);
        lastPhaseIndex = currentPhaseIndex;
      }
    });

    it('should generate unique task IDs', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const ids = result.tasks.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should generate task IDs in T-XXX format', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      for (const task of result.tasks) {
        expect(task.id).toMatch(/^T-\d{3}$/);
      }
    });

    it('should include database tasks when needed', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const databaseTasks = result.tasks.filter(t => t.phase === 'database');
      expect(databaseTasks.length).toBeGreaterThan(0);
    });

    it('should skip service layer for simple complexity', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const serviceTasks = result.tasks.filter(t => t.phase === 'services');
      expect(serviceTasks.length).toBe(0);
    });

    it('should include service layer for medium complexity', () => {
      const mediumBrief: ParsedBrief = {
        ...mockBrief,
        complexity: 'medium'
      };

      const result = generator.generate(mediumBrief, mockRequirements);

      const serviceTasks = result.tasks.filter(t => t.phase === 'services');
      expect(serviceTasks.length).toBeGreaterThan(0);
    });

    it('should count tasks by phase', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      expect(result.byPhase).toBeDefined();
      expect(result.byPhase.database).toBeGreaterThanOrEqual(0);
      expect(result.byPhase.types).toBeGreaterThanOrEqual(0);
      expect(result.byPhase.api).toBeGreaterThanOrEqual(0);
      expect(result.byPhase.tests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('task structure', () => {
    it('should generate tasks with all required fields', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      for (const task of result.tasks) {
        expect(task.id).toBeDefined();
        expect(task.phase).toBeDefined();
        expect(task.action).toBeDefined();
        expect(task.file).toBeDefined();
        expect(task.status).toBe('pending');
        expect(task.requirements).toBeDefined();
        expect(task.gotchas).toBeDefined();
        expect(task.validation).toBeDefined();
        expect(task.dependsOn).toBeDefined();
      }
    });

    it('should generate valid file paths', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      for (const task of result.tasks) {
        expect(task.file).toMatch(/^[a-zA-Z0-9/_.-]+$/);
        expect(task.file).not.toContain('undefined');
      }
    });

    it('should set action to CREATE or UPDATE', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      for (const task of result.tasks) {
        expect(['CREATE', 'UPDATE', 'DELETE']).toContain(task.action);
      }
    });

    it('should include validation commands', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      for (const task of result.tasks) {
        expect(task.validation.command).toBeDefined();
        expect(task.validation.expected).toBeDefined();
      }
    });
  });

  describe('dependencies', () => {
    it('should set dependencies correctly', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      // Types should depend on database
      const typeTask = result.tasks.find(t => t.phase === 'types');
      const dbTask = result.tasks.find(t => t.phase === 'database');

      if (typeTask && dbTask) {
        expect(typeTask.dependsOn).toContain(dbTask.id);
      }
    });

    it('should order tasks by dependency', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const taskIndex = new Map(result.tasks.map((t, i) => [t.id, i]));

      for (const task of result.tasks) {
        for (const depId of task.dependsOn) {
          const depIndex = taskIndex.get(depId);
          const currentIndex = taskIndex.get(task.id);
          expect(depIndex).toBeLessThan(currentIndex!);
        }
      }
    });

    it('should detect circular dependencies', () => {
      // This tests the warning mechanism
      const result = generator.generate(mockBrief, mockRequirements);
      // No circular deps should exist in generated tasks
      expect(result.warnings.filter(w => w.includes('Circular'))).toHaveLength(0);
    });
  });

  describe('gotcha injection', () => {
    it('should inject relevant gotchas into database tasks', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const dbTask = result.tasks.find(t => t.phase === 'database');
      if (dbTask) {
        expect(dbTask.gotchas.length).toBeGreaterThan(0);
      }
    });

    it('should inject relevant gotchas into type tasks', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const typeTask = result.tasks.find(t => t.phase === 'types');
      if (typeTask) {
        // May or may not have gotchas depending on pattern matching
        expect(typeTask.gotchas).toBeDefined();
      }
    });

    it('should limit gotchas to 3 per task', () => {
      // Create generator with many gotchas
      const manyGotchas: Gotcha[] = Array.from({ length: 10 }, (_, i) => ({
        id: `G-${String(i + 1).padStart(3, '0')}`,
        content: `Gotcha ${i + 1}`,
        filePattern: '*',
        actionType: '*',
        confidence: 'high' as const,
        source: 'knowledge_base' as const
      }));

      const genWithManyGotchas = new TaskGenerator({ gotchas: manyGotchas });
      const result = genWithManyGotchas.generate(mockBrief, mockRequirements);

      for (const task of result.tasks) {
        expect(task.gotchas.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('complexity handling', () => {
    it('should generate 5-8 tasks for simple complexity', () => {
      const result = generator.generate(mockBrief, mockRequirements);
      expect(result.tasks.length).toBeGreaterThanOrEqual(5);
      expect(result.tasks.length).toBeLessThanOrEqual(8);
    });

    it('should generate more tasks for medium vs simple complexity', () => {
      const mediumBrief: ParsedBrief = {
        ...mockBrief,
        complexity: 'medium'
      };

      const simpleResult = generator.generate(mockBrief, mockRequirements);
      const mediumResult = generator.generate(mediumBrief, mockRequirements);

      // Medium includes service layer, so more tasks
      expect(mediumResult.tasks.length).toBeGreaterThan(simpleResult.tasks.length);
    });

    it('should warn when task count is outside expected range', () => {
      // Force a brief that might generate fewer tasks
      const minimalBrief: ParsedBrief = {
        ...mockBrief,
        solution: 'Simple change',
        complexity: 'complex' // Expects 20-30 but won't generate that many
      };

      const result = generator.generate(minimalBrief, mockRequirements);
      // Should have a warning about task count
      expect(result.warnings.some(w => w.includes('Task count'))).toBe(true);
    });
  });

  describe('file naming', () => {
    it('should use feature ID in generated file paths', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const typeTask = result.tasks.find(t => t.phase === 'types');
      if (typeTask) {
        expect(typeTask.file).toContain('test-feature');
      }
    });

    it('should use migration prefix for database files', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const dbTask = result.tasks.find(t => t.phase === 'database');
      if (dbTask) {
        expect(dbTask.file).toContain('25_');
      }
    });
  });

  describe('validation commands', () => {
    it('should use sqlite3 for database validation', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const dbTask = result.tasks.find(t => t.phase === 'database');
      if (dbTask) {
        expect(dbTask.validation.command).toContain('sqlite3');
      }
    });

    it('should use tsc for type validation', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const typeTask = result.tasks.find(t => t.phase === 'types');
      if (typeTask) {
        expect(typeTask.validation.command).toContain('tsc');
      }
    });

    it('should use npm test for test validation', () => {
      const result = generator.generate(mockBrief, mockRequirements);

      const testTask = result.tasks.find(t => t.phase === 'tests');
      if (testTask) {
        expect(testTask.validation.command).toContain('npm test');
      }
    });
  });
});
