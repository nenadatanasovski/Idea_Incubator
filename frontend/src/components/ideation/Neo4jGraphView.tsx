/**
 * Neo4j Graph Visualization
 * 
 * Displays memory blocks and links from Neo4j as a force-directed graph.
 * Uses the same reagraph library as the main graph view.
 */

import { useMemo, useState, useCallback } from 'react';
import { GraphCanvas, lightTheme } from 'reagraph';
import { useMemoryBlocks, useBlockLinks } from '../../hooks/useMemoryGraph';
import type { MemoryBlock, BlockType } from '../../api/memory-graph';

interface Neo4jGraphViewProps {
  sessionId: string;
  onSelectBlock?: (block: MemoryBlock) => void;
  className?: string;
}

// Colors for different block types (ARCH-001)
const BLOCK_TYPE_COLORS: Record<BlockType, string> = {
  knowledge: '#3B82F6',   // blue
  decision: '#8B5CF6',    // purple
  assumption: '#F59E0B',  // amber
  question: '#F97316',    // orange
  requirement: '#EF4444', // red
  task: '#22C55E',        // green
  proposal: '#6366F1',    // indigo
  artifact: '#6B7280',    // gray
  evidence: '#14B8A6',    // teal
};

const BLOCK_TYPE_ICONS: Record<BlockType, string> = {
  knowledge: '📚',
  decision: '⚖️',
  assumption: '🤔',
  question: '❓',
  requirement: '📋',
  task: '✅',
  proposal: '💡',
  artifact: '📦',
  evidence: '🔍',
};

export function Neo4jGraphView({ sessionId, onSelectBlock, className = '' }: Neo4jGraphViewProps) {
  const { blocks, loading: blocksLoading, error: blocksError } = useMemoryBlocks({
    session_id: sessionId,
    limit: 100,
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  
  // Get links for the graph
  const { links } = useBlockLinks(selectedBlockId || '', 'both');

  // Transform blocks to reagraph nodes
  const nodes = useMemo(() => {
    return blocks.map(block => ({
      id: block.id,
      label: block.title || block.content.substring(0, 30) + '...',
      fill: BLOCK_TYPE_COLORS[block.type],
      data: block,
    }));
  }, [blocks]);

  // Transform links to reagraph edges
  const edges = useMemo(() => {
    // For now, show links only when a block is selected
    if (!links || links.length === 0) return [];
    
    return links.map(link => ({
      id: link.id,
      source: link.source_block_id,
      target: link.target_block_id,
      label: link.link_type,
    }));
  }, [links]);

  const handleNodeClick = useCallback((node: { id: string; data?: MemoryBlock }) => {
    setSelectedBlockId(node.id);
    if (node.data) {
      onSelectBlock?.(node.data);
    }
  }, [onSelectBlock]);

  if (blocksLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-gray-500 animate-pulse">Loading graph...</div>
      </div>
    );
  }

  if (blocksError) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-red-500">Error: {blocksError}</div>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <p className="text-4xl mb-2">🧠</p>
          <p>No blocks in memory graph yet</p>
          <p className="text-sm mt-1">Create blocks to visualize them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full ${className}`}>
      {/* Legend */}
      <div className="absolute top-2 left-2 z-10 bg-white/90 rounded-lg shadow-sm border p-2 text-xs">
        <div className="font-medium mb-1">Block Types</div>
        <div className="grid grid-cols-3 gap-1">
          {Object.entries(BLOCK_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-2 right-2 z-10 bg-white/90 rounded-lg shadow-sm border px-3 py-2 text-xs">
        <span className="font-medium">{blocks.length}</span> blocks
        {links.length > 0 && (
          <span className="ml-2">
            <span className="font-medium">{links.length}</span> links
          </span>
        )}
      </div>

      {/* Graph Canvas */}
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        theme={lightTheme}
        labelType="all"
        layoutType="forceDirected2d"
        onNodeClick={handleNodeClick}
        selections={selectedBlockId ? [selectedBlockId] : []}
      />

      {/* Selected Block Info */}
      {selectedBlockId && (
        <SelectedBlockPanel
          block={blocks.find(b => b.id === selectedBlockId)}
          linksCount={links.length}
          onClose={() => setSelectedBlockId(null)}
        />
      )}
    </div>
  );
}

interface SelectedBlockPanelProps {
  block?: MemoryBlock;
  linksCount: number;
  onClose: () => void;
}

function SelectedBlockPanel({ block, linksCount, onClose }: SelectedBlockPanelProps) {
  if (!block) return null;

  return (
    <div className="absolute bottom-2 left-2 right-2 z-10 bg-white rounded-lg shadow-lg border p-4 max-h-48 overflow-auto">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
      
      <div className="flex items-start gap-2 mb-2">
        <span className="text-2xl">{BLOCK_TYPE_ICONS[block.type]}</span>
        <div>
          <div className="font-medium text-gray-900">
            {block.title || 'Untitled'}
          </div>
          <div className="text-xs text-gray-500">
            {block.type} • {block.status} • {linksCount} links
          </div>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 line-clamp-3">
        {block.content}
      </p>
    </div>
  );
}

export default Neo4jGraphView;
