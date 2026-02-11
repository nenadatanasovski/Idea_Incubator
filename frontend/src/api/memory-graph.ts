/**
 * Memory Graph API Client
 *
 * Connects to the FastAPI Memory Graph service (Neo4j backend).
 * Default: http://localhost:8000/api/v1/memory
 */

// Use environment variable or default to localhost
const MEMORY_API_BASE =
  (import.meta as any).env?.VITE_MEMORY_API_URL ||
  "http://localhost:8000/api/v1";

// Types matching the FastAPI Pydantic models
export type BlockType =
  | "knowledge"
  | "decision"
  | "assumption"
  | "question"
  | "requirement"
  | "task"
  | "proposal"
  | "artifact"
  | "evidence";

export type BlockStatus =
  | "draft"
  | "active"
  | "validated"
  | "superseded"
  | "abandoned";
export type AbstractionLevel =
  | "vision"
  | "strategy"
  | "tactic"
  | "implementation";

export type LinkType =
  | "addresses"
  | "creates"
  | "requires"
  | "conflicts"
  | "supports"
  | "depends_on"
  | "enables"
  | "suggests"
  | "supersedes"
  | "validates"
  | "invalidates"
  | "references"
  | "evidence_for"
  | "elaborates"
  | "refines"
  | "specializes"
  | "alternative_to"
  | "instance_of"
  | "constrained_by"
  | "derived_from"
  | "measured_by";

export interface MemoryBlock {
  id: string;
  type: BlockType;
  title?: string;
  content: string;
  session_id: string;
  idea_id?: string;
  properties?: Record<string, unknown>;
  status: BlockStatus;
  confidence?: number;
  abstraction_level?: AbstractionLevel;
  artifact_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryBlockCreate {
  type: BlockType;
  title?: string;
  content: string;
  session_id: string;
  idea_id?: string;
  properties?: Record<string, unknown>;
  status?: BlockStatus;
  confidence?: number;
  abstraction_level?: AbstractionLevel;
  artifact_id?: string;
}

export interface MemoryBlockUpdate {
  type?: BlockType;
  title?: string;
  content?: string;
  properties?: Record<string, unknown>;
  status?: BlockStatus;
  confidence?: number;
  abstraction_level?: AbstractionLevel;
  artifact_id?: string;
}

export interface MemoryLink {
  id: string;
  source_block_id: string;
  target_block_id: string;
  link_type: LinkType;
  session_id: string;
  degree?: "full" | "partial" | "minimal";
  confidence?: number;
  reason?: string;
  status: "active" | "superseded" | "removed";
  created_at: string;
  updated_at: string;
}

export interface MemoryLinkCreate {
  source_block_id: string;
  target_block_id: string;
  link_type: LinkType;
  session_id: string;
  degree?: "full" | "partial" | "minimal";
  confidence?: number;
  reason?: string;
  status?: "active" | "superseded" | "removed";
}

export interface GraphStats {
  total_blocks: number;
  total_links: number;
  blocks_by_type: Record<string, number>;
  blocks_by_status: Record<string, number>;
}

export interface GraphQuery {
  session_id?: string;
  block_type?: BlockType;
  status?: BlockStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

class MemoryGraphClient {
  private baseUrl: string;

  constructor(baseUrl: string = MEMORY_API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Block operations
  async createBlock(data: MemoryBlockCreate): Promise<MemoryBlock> {
    return this.request("/memory/blocks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getBlock(blockId: string): Promise<MemoryBlock> {
    return this.request(`/memory/blocks/${blockId}`);
  }

  async listBlocks(query: GraphQuery = {}): Promise<MemoryBlock[]> {
    const params = new URLSearchParams();
    if (query.session_id) params.set("session_id", query.session_id);
    if (query.block_type) params.set("block_type", query.block_type);
    if (query.status) params.set("status", query.status);
    if (query.search) params.set("search", query.search);
    if (query.limit) params.set("limit", query.limit.toString());
    if (query.offset) params.set("offset", query.offset.toString());

    const qs = params.toString();
    return this.request(`/memory/blocks${qs ? `?${qs}` : ""}`);
  }

  async updateBlock(
    blockId: string,
    data: MemoryBlockUpdate,
  ): Promise<MemoryBlock> {
    return this.request(`/memory/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteBlock(blockId: string): Promise<void> {
    await this.request(`/memory/blocks/${blockId}`, { method: "DELETE" });
  }

  // Link operations
  async createLink(data: MemoryLinkCreate): Promise<MemoryLink> {
    return this.request("/memory/links", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getBlockLinks(
    blockId: string,
    direction: "both" | "incoming" | "outgoing" = "both",
  ): Promise<MemoryLink[]> {
    return this.request(
      `/memory/blocks/${blockId}/links?direction=${direction}`,
    );
  }

  async deleteLink(linkId: string): Promise<void> {
    await this.request(`/memory/links/${linkId}`, { method: "DELETE" });
  }

  // Stats
  async getStats(sessionId?: string): Promise<GraphStats> {
    const qs = sessionId ? `?session_id=${sessionId}` : "";
    return this.request(`/memory/stats${qs}`);
  }

  // Health check
  async checkHealth(): Promise<{ status: string; neo4j: string }> {
    return this.request("/health".replace("/api/v1", ""));
  }
}

// Export singleton instance
export const memoryGraph = new MemoryGraphClient();

// Export class for custom instances
export { MemoryGraphClient };
