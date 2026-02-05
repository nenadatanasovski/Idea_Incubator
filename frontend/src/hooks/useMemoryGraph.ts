/**
 * React hooks for Memory Graph API
 */

import { useState, useEffect, useCallback } from 'react';
import {
  memoryGraph,
  type MemoryBlock,
  type MemoryBlockCreate,
  type MemoryBlockUpdate,
  type MemoryLink,
  type MemoryLinkCreate,
  type GraphStats,
  type GraphQuery,
} from '../api/memory-graph';

interface UseMemoryBlocksResult {
  blocks: MemoryBlock[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createBlock: (data: MemoryBlockCreate) => Promise<MemoryBlock>;
  updateBlock: (id: string, data: MemoryBlockUpdate) => Promise<MemoryBlock>;
  deleteBlock: (id: string) => Promise<void>;
}

export function useMemoryBlocks(query: GraphQuery = {}): UseMemoryBlocksResult {
  const [blocks, setBlocks] = useState<MemoryBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memoryGraph.listBlocks(query);
      setBlocks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch blocks');
    } finally {
      setLoading(false);
    }
  }, [query.session_id, query.block_type, query.status, query.search, query.limit, query.offset]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const createBlock = useCallback(async (data: MemoryBlockCreate) => {
    const block = await memoryGraph.createBlock(data);
    setBlocks(prev => [block, ...prev]);
    return block;
  }, []);

  const updateBlock = useCallback(async (id: string, data: MemoryBlockUpdate) => {
    const block = await memoryGraph.updateBlock(id, data);
    setBlocks(prev => prev.map(b => b.id === id ? block : b));
    return block;
  }, []);

  const deleteBlock = useCallback(async (id: string) => {
    await memoryGraph.deleteBlock(id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  return {
    blocks,
    loading,
    error,
    refetch: fetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
  };
}

interface UseMemoryStatsResult {
  stats: GraphStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMemoryStats(sessionId?: string): UseMemoryStatsResult {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memoryGraph.getStats(sessionId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

interface UseBlockLinksResult {
  links: MemoryLink[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createLink: (data: MemoryLinkCreate) => Promise<MemoryLink>;
  deleteLink: (id: string) => Promise<void>;
}

export function useBlockLinks(
  blockId: string,
  direction: 'both' | 'incoming' | 'outgoing' = 'both',
): UseBlockLinksResult {
  const [links, setLinks] = useState<MemoryLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!blockId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await memoryGraph.getBlockLinks(blockId, direction);
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch links');
    } finally {
      setLoading(false);
    }
  }, [blockId, direction]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createLink = useCallback(async (data: MemoryLinkCreate) => {
    const link = await memoryGraph.createLink(data);
    setLinks(prev => [...prev, link]);
    return link;
  }, []);

  const deleteLink = useCallback(async (id: string) => {
    await memoryGraph.deleteLink(id);
    setLinks(prev => prev.filter(l => l.id !== id));
  }, []);

  return {
    links,
    loading,
    error,
    refetch: fetchLinks,
    createLink,
    deleteLink,
  };
}

// Health check hook
export function useMemoryGraphHealth() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    memoryGraph.checkHealth()
      .then(result => {
        setHealthy(result.status === 'healthy');
        setLoading(false);
      })
      .catch(() => {
        setHealthy(false);
        setLoading(false);
      });
  }, []);

  return { healthy, loading };
}
