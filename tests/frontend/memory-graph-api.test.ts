/**
 * Tests for Memory Graph API client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { MemoryGraphClient } from '../../frontend/src/api/memory-graph';

describe('MemoryGraphClient', () => {
  let client: MemoryGraphClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MemoryGraphClient('http://localhost:8000/api/v1');
  });

  describe('listBlocks', () => {
    it('should fetch blocks with query parameters', async () => {
      const mockBlocks = [
        { id: '1', type: 'knowledge', content: 'Test', status: 'active' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBlocks,
      });

      const result = await client.listBlocks({
        session_id: 'session-1',
        block_type: 'knowledge',
        limit: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/memory/blocks?session_id=session-1&block_type=knowledge&limit=10',
        expect.objectContaining({ headers: expect.any(Object) }),
      );
      expect(result).toEqual(mockBlocks);
    });
  });

  describe('createBlock', () => {
    it('should create a new block', async () => {
      const newBlock = {
        type: 'decision' as const,
        content: 'Decided to use Neo4j',
        session_id: 'session-1',
      };
      const createdBlock = { id: '123', ...newBlock, status: 'active' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createdBlock,
      });

      const result = await client.createBlock(newBlock);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/memory/blocks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newBlock),
        }),
      );
      expect(result.id).toBe('123');
    });
  });

  describe('getStats', () => {
    it('should fetch graph statistics', async () => {
      const mockStats = {
        total_blocks: 100,
        total_links: 50,
        blocks_by_type: { knowledge: 60, decision: 40 },
        blocks_by_status: { active: 80, draft: 20 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const result = await client.getStats();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/memory/stats',
        expect.any(Object),
      );
      expect(result.total_blocks).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Block not found' }),
      });

      await expect(client.getBlock('nonexistent')).rejects.toThrow('Block not found');
    });
  });
});
