/**
 * Code Generator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CodeGenerator,
  createCodeGenerator
} from '../../agents/build/code-generator.js';
import { AtomicTask, TaskContext, Gotcha } from '../../types/build-agent.js';

// Mock messages.create function - shared across all instances
const mockCreate = vi.fn();

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate
      }
    }))
  };
});

describe('code-generator', () => {
  let generator: CodeGenerator;

  const createMockTask = (overrides: Partial<AtomicTask> = {}): AtomicTask => ({
    id: 'T-001',
    phase: 'services',
    action: 'CREATE',
    file: 'services/test.ts',
    status: 'pending',
    requirements: ['Implement feature A', 'Handle errors'],
    gotchas: ['Use async/await'],
    validation: {
      command: 'npx tsc --noEmit',
      expected: 'exit code 0'
    },
    dependsOn: [],
    ...overrides
  });

  const createMockGotcha = (content: string): Gotcha => ({
    id: 'TG-001',
    content,
    filePattern: '*.ts',
    actionType: 'CREATE',
    severity: 'warning'
  });

  const createMockContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
    task: createMockTask(),
    specSections: [],
    dependencyOutputs: {},
    conventions: '',
    relatedFiles: {},
    gotchas: [],
    tokenCount: 0,
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock response
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```typescript\nconsole.log("generated code");\n```\n\nThis is the explanation.'
      }],
      usage: {
        input_tokens: 100,
        output_tokens: 50
      }
    });
    generator = new CodeGenerator();
  });

  describe('constructor', () => {
    it('should create generator with default options', () => {
      const defaultGenerator = new CodeGenerator();
      expect(defaultGenerator).toBeDefined();
      expect(defaultGenerator.getModel()).toBe('claude-sonnet-4-20250514');
      expect(defaultGenerator.getMaxTokens()).toBe(8192);
    });

    it('should accept custom model', () => {
      const customGenerator = new CodeGenerator({ model: 'claude-opus-4-20250514' });
      expect(customGenerator.getModel()).toBe('claude-opus-4-20250514');
    });

    it('should accept custom max tokens', () => {
      const customGenerator = new CodeGenerator({ maxTokens: 4096 });
      expect(customGenerator.getMaxTokens()).toBe(4096);
    });
  });

  describe('buildPrompt', () => {
    it('should include task info', () => {
      const task = createMockTask();
      const context = createMockContext({ task });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('T-001');
      expect(prompt).toContain('CREATE');
      expect(prompt).toContain('services/test.ts');
      expect(prompt).toContain('services');
    });

    it('should include requirements', () => {
      const task = createMockTask({
        requirements: ['Requirement 1', 'Requirement 2']
      });
      const context = createMockContext({ task });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Requirement 1');
      expect(prompt).toContain('Requirement 2');
    });

    it('should include gotchas', () => {
      const task = createMockTask();
      const context = createMockContext({
        task,
        gotchas: [
          createMockGotcha('Gotcha 1'),
          createMockGotcha('Gotcha 2')
        ]
      });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Gotcha 1');
      expect(prompt).toContain('Gotcha 2');
      expect(prompt).toContain('Important Notes');
    });

    it('should include code template', () => {
      const task = createMockTask({
        codeTemplate: 'export function hello() { return "world"; }'
      });
      const context = createMockContext({ task });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Code Template');
      expect(prompt).toContain('export function hello()');
    });

    it('should include conventions', () => {
      const task = createMockTask();
      const context = createMockContext({
        task,
        conventions: '# Project Conventions\n\nUse TypeScript.'
      });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Project Conventions');
      expect(prompt).toContain('Use TypeScript');
    });

    it('should include dependency outputs', () => {
      const task = createMockTask();
      const context = createMockContext({
        task,
        dependencyOutputs: {
          'types/base.ts': 'export interface Base { id: string; }'
        }
      });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Dependency Files');
      expect(prompt).toContain('types/base.ts');
      expect(prompt).toContain('export interface Base');
    });

    it('should include related files', () => {
      const task = createMockTask();
      const context = createMockContext({
        task,
        relatedFiles: {
          'services/helper.ts': 'export function helper() {}'
        }
      });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Related Files');
      expect(prompt).toContain('services/helper.ts');
      expect(prompt).toContain('export function helper');
    });

    it('should include spec sections', () => {
      const task = createMockTask();
      const context = createMockContext({
        task,
        specSections: ['## Architecture\n\nUse hexagonal pattern']
      });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Specification Sections');
      expect(prompt).toContain('hexagonal pattern');
    });

    it('should include instructions', () => {
      const task = createMockTask();
      const context = createMockContext({ task });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).toContain('Instructions');
      expect(prompt).toContain('Generate the complete code');
      expect(prompt).toContain(task.file);
    });

    it('should not include empty sections', () => {
      const task = createMockTask({ codeTemplate: undefined });
      const context = createMockContext({
        task,
        conventions: '',
        gotchas: [],
        dependencyOutputs: {},
        relatedFiles: {},
        specSections: []
      });
      const prompt = generator.buildPrompt(task, context);

      expect(prompt).not.toContain('Code Template');
      expect(prompt).not.toContain('Important Notes');
      expect(prompt).not.toContain('Dependency Files');
      expect(prompt).not.toContain('Related Files');
      expect(prompt).not.toContain('Specification Sections');
    });
  });

  describe('generate', () => {
    it('should call Claude API', async () => {
      const task = createMockTask();
      const context = createMockContext({ task });

      const code = await generator.generate(task, context);

      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
    });

    it('should extract code from response', async () => {
      const task = createMockTask();
      const context = createMockContext({ task });

      const code = await generator.generate(task, context);

      expect(code).toBe('console.log("generated code");');
    });

    it('should handle response without code block', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: 'Just plain text without code block'
        }],
        usage: { input_tokens: 50, output_tokens: 25 }
      });

      const task = createMockTask();
      const context = createMockContext({ task });

      const code = await generator.generate(task, context);

      expect(code).toBe('Just plain text without code block');
    });
  });

  describe('generateWithDetails', () => {
    it('should return code, explanation, and token count', async () => {
      const task = createMockTask();
      const context = createMockContext({ task });

      const result = await generator.generateWithDetails(task, context);

      expect(result.code).toBe('console.log("generated code");');
      expect(result.explanation).toBe('This is the explanation.');
      expect(result.tokensUsed).toBe(150);
    });

    it('should handle missing explanation', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: '```typescript\nconst x = 1;\n```'
        }],
        usage: { input_tokens: 50, output_tokens: 25 }
      });

      const task = createMockTask();
      const context = createMockContext({ task });

      const result = await generator.generateWithDetails(task, context);

      expect(result.code).toBe('const x = 1;');
      expect(result.explanation).toBe('');
    });
  });

  describe('setters', () => {
    it('should set model', () => {
      generator.setModel('claude-opus-4-20250514');
      expect(generator.getModel()).toBe('claude-opus-4-20250514');
    });

    it('should set max tokens', () => {
      generator.setMaxTokens(16384);
      expect(generator.getMaxTokens()).toBe(16384);
    });
  });

  describe('createCodeGenerator', () => {
    it('should create generator instance', () => {
      const instance = createCodeGenerator();
      expect(instance).toBeInstanceOf(CodeGenerator);
    });

    it('should pass options', () => {
      const instance = createCodeGenerator({ model: 'claude-opus-4-20250514' });
      expect(instance.getModel()).toBe('claude-opus-4-20250514');
    });
  });
});
