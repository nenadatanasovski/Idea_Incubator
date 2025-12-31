import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  StreamingResponseHandler,
  encodeSSE,
  createSSEStream,
} from '../../agents/ideation/streaming.js';

describe('StreamingResponseHandler', () => {

  describe('parseResponse', () => {

    test('PASS: Parses valid JSON response', () => {
      const mockClient = {} as any;
      const handler = new StreamingResponseHandler(mockClient);
      const response = handler.parseResponse(`
        {"text": "Hello", "buttons": null, "signals": {}}
      `);

      expect(response.text).toBe('Hello');
      expect(response.buttons).toBeNull();
    });

    test('PASS: Handles text-only response', () => {
      const mockClient = {} as any;
      const handler = new StreamingResponseHandler(mockClient);
      const response = handler.parseResponse('Just plain text without JSON');

      expect(response.text).toBe('Just plain text without JSON');
      expect(response.buttons).toBeNull();
    });

    test('PASS: Extracts JSON from mixed content', () => {
      const mockClient = {} as any;
      const handler = new StreamingResponseHandler(mockClient);
      const response = handler.parseResponse(`
        Some preamble text
        {"text": "The actual response", "buttons": [{"id": "1", "label": "Option"}]}
        Some postamble
      `);

      expect(response.text).toBe('The actual response');
      expect(response.buttons).toHaveLength(1);
    });

    test('PASS: Handles malformed JSON gracefully', () => {
      const mockClient = {} as any;
      const handler = new StreamingResponseHandler(mockClient);
      const response = handler.parseResponse('{"text": "incomplete');

      expect(response.text).toContain('incomplete');
    });

    test('PASS: Extracts form from response', () => {
      const mockClient = {} as any;
      const handler = new StreamingResponseHandler(mockClient);
      const response = handler.parseResponse(`
        {"text": "Fill this out", "form": {"fields": [{"id": "f1", "label": "Name"}]}}
      `);

      expect(response.form).not.toBeNull();
    });

    test('PASS: Extracts candidateUpdate from response', () => {
      const mockClient = {} as any;
      const handler = new StreamingResponseHandler(mockClient);
      const response = handler.parseResponse(`
        {"text": "Idea forming", "candidateUpdate": {"title": "New Idea", "summary": "A great idea"}}
      `);

      expect(response.candidateUpdate).not.toBeNull();
      expect(response.candidateUpdate?.title).toBe('New Idea');
    });

    test('PASS: Extracts signals from response', () => {
      const mockClient = {} as any;
      const handler = new StreamingResponseHandler(mockClient);
      const response = handler.parseResponse(`
        {"text": "Got it", "signals": {"selfDiscovery": {"impactVision": {"level": "world"}}}}
      `);

      expect(response.signals).toBeDefined();
      expect(response.signals.selfDiscovery?.impactVision).toBeDefined();
    });
  });

  describe('encodeSSE', () => {

    test('PASS: Encodes string data', () => {
      const encoded = encodeSSE('text_delta', 'Hello');

      expect(encoded).toBe('event: text_delta\ndata: Hello\n\n');
    });

    test('PASS: Encodes object data as JSON', () => {
      const encoded = encodeSSE('message_complete', { text: 'Hello' });

      expect(encoded).toContain('event: message_complete');
      expect(encoded).toContain('{"text":"Hello"}');
    });
  });

  describe('createSSEStream', () => {

    test('PASS: Sets correct headers', () => {
      const mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      createSSEStream(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.flushHeaders).toHaveBeenCalled();
    });

    test('PASS: Send writes to response', () => {
      const mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      const stream = createSSEStream(mockRes);
      stream.send('test', 'data');

      expect(mockRes.write).toHaveBeenCalled();
    });

    test('PASS: End sends done event', () => {
      const mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      const stream = createSSEStream(mockRes);
      stream.end();

      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('done'));
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
