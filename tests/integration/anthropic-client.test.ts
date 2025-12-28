import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAnthropicClient, mockEvaluationResponse } from '../mocks/anthropic.js';

describe('Anthropic Client Integration', () => {
  let mockClient: ReturnType<typeof createMockAnthropicClient>;

  beforeEach(() => {
    mockClient = createMockAnthropicClient();
  });

  it('should create a message with system prompt', async () => {
    mockClient.messages.create.mockResolvedValueOnce(
      mockEvaluationResponse({ 'Problem Clarity': 8 })
    );

    const response = await mockClient.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 1024,
      system: 'You are an evaluator.',
      messages: [{ role: 'user', content: 'Evaluate this idea' }]
    });

    expect(response.content[0].type).toBe('text');
    expect(response.usage.input_tokens).toBeGreaterThan(0);
  });

  it('should parse JSON from response', () => {
    const response = mockEvaluationResponse({ 'Problem Clarity': 8 });
    const text = response.content[0].text;
    const parsed = JSON.parse(text);

    expect(parsed.evaluations).toBeDefined();
    expect(parsed.evaluations[0].score).toBe(8);
  });

  it('should track token usage', async () => {
    const response = mockEvaluationResponse({ 'Problem Clarity': 8, 'Market Size': 6 });

    expect(response.usage.input_tokens).toBe(500);
    expect(response.usage.output_tokens).toBe(1000);
  });

  it('should handle mock evaluation response structure', () => {
    const response = mockEvaluationResponse({
      'Problem Clarity': 8,
      'Market Size': 6,
      'Technical Risk': 7
    });

    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.evaluations).toHaveLength(3);
    expect(parsed.evaluations[0].confidence).toBe(0.8);
    expect(parsed.evaluations[0].reasoning).toBe('Test reasoning');
  });
});
