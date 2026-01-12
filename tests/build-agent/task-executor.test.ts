/**
 * Task Executor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TaskExecutor,
  TaskState,
  ExecutionResult,
  createTaskExecutor,
  CodeGeneratorInterface,
  FileWriterInterface,
  ValidationRunnerInterface
} from '../../agents/build/task-executor.js';
import { AtomicTask, TaskContext } from '../../types/build-agent.js';

// Mock context-primer
vi.mock('../../agents/build/context-primer.js', () => ({
  ContextPrimer: vi.fn().mockImplementation(() => ({
    loadTask: vi.fn().mockResolvedValue({
      task: {},
      specSections: [],
      dependencyOutputs: {},
      conventions: '',
      relatedFiles: {},
      gotchas: [],
      tokenCount: 0
    })
  }))
}));

describe('task-executor', () => {
  let executor: TaskExecutor;

  const createMockTask = (overrides: Partial<AtomicTask> = {}): AtomicTask => ({
    id: 'T-001',
    phase: 'database',
    action: 'CREATE',
    file: 'database/migrations/001.sql',
    status: 'pending',
    requirements: ['Create table'],
    gotchas: ['Use TEXT for timestamps'],
    validation: {
      command: 'echo ok',
      expected: 'ok'
    },
    codeTemplate: '-- SQL code',
    dependsOn: [],
    ...overrides
  });

  const mockCodeGenerator: CodeGeneratorInterface = {
    generate: vi.fn().mockResolvedValue('// Generated code')
  };

  const mockFileWriter: FileWriterInterface = {
    write: vi.fn().mockResolvedValue({ success: true })
  };

  const mockValidationRunner: ValidationRunnerInterface = {
    run: vi.fn().mockResolvedValue({ success: true, output: 'ok' })
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to default success
    (mockCodeGenerator.generate as ReturnType<typeof vi.fn>).mockResolvedValue('// Generated code');
    (mockFileWriter.write as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (mockValidationRunner.run as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, output: 'ok' });

    executor = new TaskExecutor({
      maxRetries: 3,
      retryDelay: 10, // Short delay for tests
      codeGenerator: mockCodeGenerator,
      fileWriter: mockFileWriter,
      validationRunner: mockValidationRunner
    });
  });

  describe('constructor', () => {
    it('should create executor with default options', () => {
      const defaultExecutor = new TaskExecutor();
      expect(defaultExecutor).toBeDefined();
    });

    it('should accept custom options', () => {
      const customExecutor = new TaskExecutor({
        maxRetries: 5,
        retryDelay: 2000
      });
      expect(customExecutor).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute single task', async () => {
      const task = createMockTask();
      const results = await executor.execute([task], '/test/tasks.md');

      expect(results).toHaveLength(1);
      expect(results[0].taskId).toBe('T-001');
      expect(results[0].state).toBe('done');
    });

    it('should execute multiple tasks in order', async () => {
      const task1 = createMockTask({ id: 'T-001' });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });

      const results = await executor.execute([task1, task2], '/test/tasks.md');

      expect(results).toHaveLength(2);
      expect(results[0].taskId).toBe('T-001');
      expect(results[1].taskId).toBe('T-002');
    });

    it('should skip tasks with unsatisfied dependencies', async () => {
      const task1 = createMockTask({ id: 'T-001' });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });

      // Make task1 fail all retries (maxRetries: 3)
      (mockValidationRunner.run as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ success: false, output: 'validation failed' })
        .mockResolvedValueOnce({ success: false, output: 'validation failed' })
        .mockResolvedValueOnce({ success: false, output: 'validation failed' });

      const results = await executor.execute([task1, task2], '/test/tasks.md');

      expect(results).toHaveLength(2);
      expect(results[0].state).toBe('failed');
      expect(results[1].state).toBe('skipped');
    });

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn();
      const progressExecutor = new TaskExecutor({
        onProgress,
        codeGenerator: mockCodeGenerator,
        fileWriter: mockFileWriter,
        validationRunner: mockValidationRunner
      });

      const task = createMockTask();
      await progressExecutor.execute([task], '/test/tasks.md');

      expect(onProgress).toHaveBeenCalled();
    });

    it('should call onTaskComplete callback', async () => {
      const onTaskComplete = vi.fn();
      const callbackExecutor = new TaskExecutor({
        onTaskComplete,
        codeGenerator: mockCodeGenerator,
        fileWriter: mockFileWriter,
        validationRunner: mockValidationRunner
      });

      const task = createMockTask();
      await callbackExecutor.execute([task], '/test/tasks.md');

      expect(onTaskComplete).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'T-001', state: 'done' })
      );
    });
  });

  describe('executeOne', () => {
    it('should execute single task successfully', async () => {
      const task = createMockTask();
      const context: TaskContext = {
        task,
        specSections: [],
        dependencyOutputs: {},
        conventions: '',
        relatedFiles: {},
        gotchas: [],
        tokenCount: 0
      };

      const result = await executor.executeOne(task, context);

      expect(result.state).toBe('done');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return failed state on error', async () => {
      (mockFileWriter.write as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        error: 'Write failed'
      });

      const task = createMockTask();
      const context: TaskContext = {
        task,
        specSections: [],
        dependencyOutputs: {},
        conventions: '',
        relatedFiles: {},
        gotchas: [],
        tokenCount: 0
      };

      const result = await executor.executeOne(task, context);

      expect(result.state).toBe('failed');
      expect(result.error).toContain('Write failed');
    });

    it('should call code generator', async () => {
      const task = createMockTask();
      const context: TaskContext = {
        task,
        specSections: [],
        dependencyOutputs: {},
        conventions: '',
        relatedFiles: {},
        gotchas: [],
        tokenCount: 0
      };

      await executor.executeOne(task, context);

      expect(mockCodeGenerator.generate).toHaveBeenCalledWith(task, context);
    });

    it('should call file writer', async () => {
      const task = createMockTask();
      const context: TaskContext = {
        task,
        specSections: [],
        dependencyOutputs: {},
        conventions: '',
        relatedFiles: {},
        gotchas: [],
        tokenCount: 0
      };

      await executor.executeOne(task, context);

      expect(mockFileWriter.write).toHaveBeenCalled();
    });

    it('should call validation runner', async () => {
      const task = createMockTask();
      const context: TaskContext = {
        task,
        specSections: [],
        dependencyOutputs: {},
        conventions: '',
        relatedFiles: {},
        gotchas: [],
        tokenCount: 0
      };

      await executor.executeOne(task, context);

      expect(mockValidationRunner.run).toHaveBeenCalledWith('echo ok', 'ok');
    });
  });

  describe('TaskState', () => {
    it('should track task states', async () => {
      const task = createMockTask();
      await executor.execute([task], '/test/tasks.md');

      expect(executor.getTaskState('T-001')).toBe('done');
    });

    it('should return undefined for unknown task', () => {
      expect(executor.getTaskState('UNKNOWN')).toBeUndefined();
    });

    it('should get all task states', async () => {
      const task1 = createMockTask({ id: 'T-001' });
      const task2 = createMockTask({ id: 'T-002' });

      await executor.execute([task1, task2], '/test/tasks.md');

      const states = executor.getAllTaskStates();
      expect(states.size).toBe(2);
      expect(states.get('T-001')).toBe('done');
      expect(states.get('T-002')).toBe('done');
    });
  });

  describe('retry logic', () => {
    it('should retry failed tasks', async () => {
      // Fail twice, then succeed
      (mockValidationRunner.run as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ success: false, output: 'fail 1' })
        .mockResolvedValueOnce({ success: false, output: 'fail 2' })
        .mockResolvedValueOnce({ success: true, output: 'ok' });

      const task = createMockTask();
      const results = await executor.execute([task], '/test/tasks.md');

      expect(results[0].state).toBe('done');
      expect(results[0].attempt).toBe(3);
    });

    it('should fail after max retries', async () => {
      // Always fail
      (mockValidationRunner.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        output: 'always fail'
      });

      const task = createMockTask();
      const results = await executor.execute([task], '/test/tasks.md');

      expect(results[0].state).toBe('failed');
      expect(results[0].attempt).toBe(3);
    });

    it('should call onTaskFailed after max retries', async () => {
      const onTaskFailed = vi.fn();
      const failExecutor = new TaskExecutor({
        maxRetries: 2,
        retryDelay: 10,
        onTaskFailed,
        codeGenerator: mockCodeGenerator,
        fileWriter: mockFileWriter,
        validationRunner: mockValidationRunner
      });

      (mockValidationRunner.run as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        output: 'fail'
      });

      const task = createMockTask();
      await failExecutor.execute([task], '/test/tasks.md');

      expect(onTaskFailed).toHaveBeenCalledWith('T-001', expect.any(Error));
    });
  });

  describe('dependency ordering', () => {
    it('should order tasks by dependencies', async () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: [] });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });
      const task3 = createMockTask({ id: 'T-003', dependsOn: ['T-002'] });

      // Provide in reverse order
      const results = await executor.execute([task3, task2, task1], '/test/tasks.md');

      expect(results[0].taskId).toBe('T-001');
      expect(results[1].taskId).toBe('T-002');
      expect(results[2].taskId).toBe('T-003');
    });

    it('should detect circular dependencies', async () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: ['T-002'] });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });

      await expect(executor.execute([task1, task2], '/test/tasks.md'))
        .rejects.toThrow('Circular dependency detected');
    });

    it('should handle complex dependency chains', async () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: [] });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });
      const task3 = createMockTask({ id: 'T-003', dependsOn: ['T-001'] });
      const task4 = createMockTask({ id: 'T-004', dependsOn: ['T-002', 'T-003'] });

      const results = await executor.execute([task4, task3, task2, task1], '/test/tasks.md');

      expect(results[0].taskId).toBe('T-001');
      expect(results[3].taskId).toBe('T-004');
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      const task = createMockTask();
      await executor.execute([task], '/test/tasks.md');

      expect(executor.getTaskState('T-001')).toBe('done');

      executor.reset();

      expect(executor.getTaskState('T-001')).toBeUndefined();
    });
  });

  describe('getTaskResult', () => {
    it('should return task result', async () => {
      const task = createMockTask();
      await executor.execute([task], '/test/tasks.md');

      const result = executor.getTaskResult('T-001');
      expect(result).toBeDefined();
      expect(result?.state).toBe('done');
    });

    it('should return undefined for unknown task', () => {
      expect(executor.getTaskResult('UNKNOWN')).toBeUndefined();
    });
  });

  describe('setters', () => {
    it('should set code generator', () => {
      const newGenerator: CodeGeneratorInterface = {
        generate: vi.fn().mockResolvedValue('new code')
      };

      executor.setCodeGenerator(newGenerator);
      // No direct way to verify, but shouldn't throw
    });

    it('should set file writer', () => {
      const newWriter: FileWriterInterface = {
        write: vi.fn().mockResolvedValue({ success: true })
      };

      executor.setFileWriter(newWriter);
    });

    it('should set validation runner', () => {
      const newRunner: ValidationRunnerInterface = {
        run: vi.fn().mockResolvedValue({ success: true, output: '' })
      };

      executor.setValidationRunner(newRunner);
    });
  });

  describe('createTaskExecutor', () => {
    it('should create executor instance', () => {
      const instance = createTaskExecutor();
      expect(instance).toBeInstanceOf(TaskExecutor);
    });

    it('should pass options', () => {
      const onProgress = vi.fn();
      const instance = createTaskExecutor({ onProgress });
      expect(instance).toBeDefined();
    });
  });

  describe('validateDependencyGraph', () => {
    it('should validate valid dependency graph', () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: [] });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });

      const errors = executor.validateDependencyGraph([task1, task2]);

      expect(errors).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: ['T-999'] });

      const errors = executor.validateDependencyGraph([task1]);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('non-existent task T-999');
    });

    it('should detect self-dependency', () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: ['T-001'] });

      const errors = executor.validateDependencyGraph([task1]);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('depends on itself'))).toBe(true);
    });

    it('should detect circular dependencies in validation', () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: ['T-002'] });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });

      const errors = executor.validateDependencyGraph([task1, task2]);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Circular dependency detected');
    });

    it('should detect multiple errors', () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: ['T-001', 'T-999'] });

      const errors = executor.validateDependencyGraph([task1]);

      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('visualizeDependencyGraph', () => {
    it('should generate DOT format graph', () => {
      const task1 = createMockTask({ id: 'T-001', phase: 'database', dependsOn: [] });
      const task2 = createMockTask({ id: 'T-002', phase: 'api', dependsOn: ['T-001'] });

      const dot = executor.visualizeDependencyGraph([task1, task2]);

      expect(dot).toContain('digraph TaskDependencies');
      expect(dot).toContain('"T-001"');
      expect(dot).toContain('"T-002"');
      expect(dot).toContain('"T-001" -> "T-002"');
    });

    it('should include task states in visualization', async () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: [] });
      await executor.execute([task1], '/test/tasks.md');

      const dot = executor.visualizeDependencyGraph([task1]);

      expect(dot).toContain('lightgreen'); // done state
    });

    it('should handle tasks with no dependencies', () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: [] });
      const task2 = createMockTask({ id: 'T-002', dependsOn: [] });

      const dot = executor.visualizeDependencyGraph([task1, task2]);

      expect(dot).toContain('"T-001"');
      expect(dot).toContain('"T-002"');
      expect(dot).not.toContain('->');
    });

    it('should handle complex dependency graphs', () => {
      const task1 = createMockTask({ id: 'T-001', dependsOn: [] });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });
      const task3 = createMockTask({ id: 'T-003', dependsOn: ['T-001'] });
      const task4 = createMockTask({ id: 'T-004', dependsOn: ['T-002', 'T-003'] });

      const dot = executor.visualizeDependencyGraph([task1, task2, task3, task4]);

      expect(dot).toContain('"T-001" -> "T-002"');
      expect(dot).toContain('"T-001" -> "T-003"');
      expect(dot).toContain('"T-002" -> "T-004"');
      expect(dot).toContain('"T-003" -> "T-004"');
    });
  });

  describe('improved error messages', () => {
    it('should provide detailed error when dependencies fail', async () => {
      const task1 = createMockTask({ id: 'T-001' });
      const task2 = createMockTask({ id: 'T-002', dependsOn: ['T-001'] });

      // Make task1 fail
      (mockValidationRunner.run as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ success: false, output: 'fail' })
        .mockResolvedValueOnce({ success: false, output: 'fail' })
        .mockResolvedValueOnce({ success: false, output: 'fail' });

      const results = await executor.execute([task1, task2], '/test/tasks.md');

      expect(results[1].state).toBe('skipped');
      expect(results[1].error).toContain('T-001');
      expect(results[1].error).toContain('failed');
    });
  });
});
