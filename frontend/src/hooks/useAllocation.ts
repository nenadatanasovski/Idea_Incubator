import { useState, useEffect, useCallback } from 'react';
import {
  getFinancialAllocation,
  saveFinancialAllocation,
  deleteFinancialAllocation,
  getPositioningDecision,
  savePositioningDecision,
} from '../api/client';
import type {
  IdeaFinancialAllocation,
  StrategicApproach,
  PositioningDecision,
} from '../types';

interface UseAllocationOptions {
  autoLoad?: boolean;
}

interface AllocationState {
  allocation: IdeaFinancialAllocation | null;
  decision: PositioningDecision | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface UseAllocationReturn extends AllocationState {
  // Allocation actions
  loadAllocation: () => Promise<void>;
  saveAllocation: (data: Partial<IdeaFinancialAllocation>) => Promise<void>;
  removeAllocation: () => Promise<void>;
  updateApproach: (approach: StrategicApproach) => Promise<void>;

  // Decision actions
  loadDecision: () => Promise<void>;
  saveDecision: (data: Partial<PositioningDecision>) => Promise<void>;

  // Utility
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing per-idea financial allocation and positioning decisions.
 * Handles loading, saving, and state management for the Position phase.
 */
export function useAllocation(
  slug: string | undefined,
  options: UseAllocationOptions = {}
): UseAllocationReturn {
  const { autoLoad = true } = options;

  const [state, setState] = useState<AllocationState>({
    allocation: null,
    decision: null,
    isLoading: false,
    isSaving: false,
    error: null,
  });

  // Load allocation data
  const loadAllocation = useCallback(async () => {
    if (!slug) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await getFinancialAllocation(slug);
      setState(prev => ({
        ...prev,
        allocation: data.exists ? (data as IdeaFinancialAllocation) : null,
        isLoading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load allocation',
      }));
    }
  }, [slug]);

  // Load decision data
  const loadDecision = useCallback(async () => {
    if (!slug) return;

    try {
      const data = await getPositioningDecision(slug);
      setState(prev => ({
        ...prev,
        decision: data.exists ? (data as PositioningDecision) : null,
      }));
    } catch (err) {
      console.error('Failed to load positioning decision:', err);
    }
  }, [slug]);

  // Save allocation
  const saveAllocation = useCallback(async (data: Partial<IdeaFinancialAllocation>) => {
    if (!slug) return;

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      await saveFinancialAllocation(slug, data);
      // Reload to get the full updated data
      await loadAllocation();
      setState(prev => ({ ...prev, isSaving: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: err instanceof Error ? err.message : 'Failed to save allocation',
      }));
      throw err;
    }
  }, [slug, loadAllocation]);

  // Update strategic approach
  const updateApproach = useCallback(async (approach: StrategicApproach) => {
    await saveAllocation({ ...state.allocation, strategicApproach: approach });
  }, [saveAllocation, state.allocation]);

  // Remove allocation
  const removeAllocation = useCallback(async () => {
    if (!slug) return;

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      await deleteFinancialAllocation(slug);
      setState(prev => ({
        ...prev,
        allocation: null,
        isSaving: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: err instanceof Error ? err.message : 'Failed to delete allocation',
      }));
      throw err;
    }
  }, [slug]);

  // Save decision
  const saveDecision = useCallback(async (data: Partial<PositioningDecision>) => {
    if (!slug) return;

    setState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      await savePositioningDecision(slug, data);
      await loadDecision();
      setState(prev => ({ ...prev, isSaving: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: err instanceof Error ? err.message : 'Failed to save decision',
      }));
      throw err;
    }
  }, [slug, loadDecision]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([loadAllocation(), loadDecision()]);
  }, [loadAllocation, loadDecision]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && slug) {
      loadAllocation();
      loadDecision();
    }
  }, [autoLoad, slug, loadAllocation, loadDecision]);

  return {
    ...state,
    loadAllocation,
    saveAllocation,
    removeAllocation,
    updateApproach,
    loadDecision,
    saveDecision,
    refresh,
    clearError,
  };
}

export default useAllocation;
