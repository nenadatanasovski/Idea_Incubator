// server/communication/agent-handshake.ts
// COM-014: Agent Handshake - Registration and communication setup

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { AgentType } from './types';

interface Database {
  run(sql: string, params?: unknown[]): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export type HandshakeState = 'pending' | 'hello_sent' | 'ack_received' | 'ready' | 'failed' | 'disconnected';

export interface AgentRegistration {
  agentId: string;
  agentType: AgentType;
  sessionId: string;
  ideaId?: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface HandshakeSession {
  id: string;
  agentId: string;
  agentType: AgentType;
  state: HandshakeState;
  registeredAt: Date;
  helloSentAt?: Date;
  ackReceivedAt?: Date;
  readyAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  lastHeartbeat?: Date;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

export interface HandshakeConfig {
  helloTimeoutMs: number;
  ackTimeoutMs: number;
  heartbeatIntervalMs: number;
  maxMissedHeartbeats: number;
}

const DEFAULT_CONFIG: HandshakeConfig = {
  helloTimeoutMs: 5000,
  ackTimeoutMs: 10000,
  heartbeatIntervalMs: 30000,
  maxMissedHeartbeats: 3,
};

export class AgentHandshake extends EventEmitter {
  private db: Database;
  private config: HandshakeConfig;
  private sessions: Map<string, HandshakeSession> = new Map();
  private pendingHellos: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pendingAcks: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private missedHeartbeats: Map<string, number> = new Map();

  constructor(db: Database, config: Partial<HandshakeConfig> = {}) {
    super();
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the handshake manager.
   */
  async start(): Promise<void> {
    // Load existing sessions
    await this.loadSessions();

    // Resume heartbeats for ready sessions
    for (const session of this.sessions.values()) {
      if (session.state === 'ready') {
        this.startHeartbeat(session.agentId);
      }
    }

    console.log(`[AgentHandshake] Started with ${this.sessions.size} sessions`);
  }

  /**
   * Stop the handshake manager.
   */
  async stop(): Promise<void> {
    // Clear all timers
    for (const timeout of this.pendingHellos.values()) {
      clearTimeout(timeout);
    }
    this.pendingHellos.clear();

    for (const timeout of this.pendingAcks.values()) {
      clearTimeout(timeout);
    }
    this.pendingAcks.clear();

    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();

    console.log('[AgentHandshake] Stopped');
  }

  /**
   * Register a new agent and initiate handshake.
   * Step 1: Agent calls register() to start handshake
   */
  async register(registration: AgentRegistration): Promise<HandshakeSession> {
    const sessionId = uuid();
    const now = new Date();

    const session: HandshakeSession = {
      id: sessionId,
      agentId: registration.agentId,
      agentType: registration.agentType,
      state: 'pending',
      registeredAt: now,
      capabilities: registration.capabilities,
      metadata: registration.metadata,
    };

    this.sessions.set(registration.agentId, session);
    await this.storeSession(session);

    this.emit('agent:registered', { agentId: registration.agentId, session });
    console.log(`[AgentHandshake] Registered agent ${registration.agentId}`);

    // Automatically send hello
    await this.sendHello(registration.agentId);

    return session;
  }

  /**
   * Send hello message to agent.
   * Step 2: System sends hello to agent
   */
  async sendHello(agentId: string): Promise<boolean> {
    const session = this.sessions.get(agentId);

    if (!session) {
      console.warn(`[AgentHandshake] No session for ${agentId}`);
      return false;
    }

    if (session.state !== 'pending') {
      console.warn(`[AgentHandshake] Cannot send hello in state ${session.state}`);
      return false;
    }

    session.state = 'hello_sent';
    session.helloSentAt = new Date();
    await this.updateSession(session);

    // Set timeout for ACK
    const timeout = setTimeout(() => {
      this.handleAckTimeout(agentId);
    }, this.config.ackTimeoutMs);
    this.pendingAcks.set(agentId, timeout);

    this.emit('hello:sent', {
      agentId,
      message: {
        type: 'hello',
        sessionId: session.id,
        timestamp: session.helloSentAt.toISOString(),
        config: {
          heartbeatIntervalMs: this.config.heartbeatIntervalMs,
        },
      },
    });

    console.log(`[AgentHandshake] Hello sent to ${agentId}`);
    return true;
  }

  /**
   * Receive ACK from agent.
   * Step 3: Agent responds with ACK
   */
  async receiveAck(agentId: string, ackData?: Record<string, unknown>): Promise<boolean> {
    const session = this.sessions.get(agentId);

    if (!session) {
      console.warn(`[AgentHandshake] No session for ${agentId}`);
      return false;
    }

    if (session.state !== 'hello_sent') {
      console.warn(`[AgentHandshake] Unexpected ACK in state ${session.state}`);
      return false;
    }

    // Clear ACK timeout
    const timeout = this.pendingAcks.get(agentId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingAcks.delete(agentId);
    }

    session.state = 'ack_received';
    session.ackReceivedAt = new Date();

    if (ackData) {
      session.metadata = { ...session.metadata, ...ackData };
    }

    await this.updateSession(session);

    this.emit('ack:received', { agentId, session, ackData });
    console.log(`[AgentHandshake] ACK received from ${agentId}`);

    // Automatically transition to ready
    await this.markReady(agentId);

    return true;
  }

  /**
   * Mark agent as ready.
   * Step 4: System marks agent as ready to communicate
   */
  async markReady(agentId: string): Promise<boolean> {
    const session = this.sessions.get(agentId);

    if (!session) {
      return false;
    }

    if (session.state !== 'ack_received') {
      console.warn(`[AgentHandshake] Cannot mark ready in state ${session.state}`);
      return false;
    }

    session.state = 'ready';
    session.readyAt = new Date();
    session.lastHeartbeat = new Date();

    await this.updateSession(session);

    // Start heartbeat monitoring
    this.startHeartbeat(agentId);

    this.emit('agent:ready', { agentId, session });
    console.log(`[AgentHandshake] Agent ${agentId} is ready`);

    return true;
  }

  /**
   * Process heartbeat from agent.
   */
  async heartbeat(agentId: string): Promise<boolean> {
    const session = this.sessions.get(agentId);

    if (!session || session.state !== 'ready') {
      return false;
    }

    session.lastHeartbeat = new Date();
    this.missedHeartbeats.set(agentId, 0);

    await this.db.run(
      'UPDATE active_agents SET last_heartbeat = ? WHERE agent_id = ?',
      [session.lastHeartbeat.toISOString(), agentId]
    );

    this.emit('heartbeat:received', { agentId });
    return true;
  }

  /**
   * Disconnect an agent.
   */
  async disconnect(agentId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(agentId);

    if (!session) {
      return;
    }

    // Clear timers
    const ackTimeout = this.pendingAcks.get(agentId);
    if (ackTimeout) {
      clearTimeout(ackTimeout);
      this.pendingAcks.delete(agentId);
    }

    const heartbeatInterval = this.heartbeatIntervals.get(agentId);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(agentId);
    }

    session.state = 'disconnected';
    await this.updateSession(session);

    // Remove from active agents
    await this.db.run(
      'UPDATE active_agents SET state = ?, updated_at = ? WHERE agent_id = ?',
      ['disconnected', new Date().toISOString(), agentId]
    );

    this.emit('agent:disconnected', { agentId, reason });
    console.log(`[AgentHandshake] Disconnected ${agentId}: ${reason || 'no reason'}`);
  }

  /**
   * Get session for an agent.
   */
  getSession(agentId: string): HandshakeSession | null {
    return this.sessions.get(agentId) || null;
  }

  /**
   * Check if an agent is ready.
   */
  isReady(agentId: string): boolean {
    const session = this.sessions.get(agentId);
    return session?.state === 'ready';
  }

  /**
   * Get all ready agents.
   */
  getReadyAgents(): HandshakeSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.state === 'ready');
  }

  /**
   * Get agents by type.
   */
  getAgentsByType(agentType: AgentType): HandshakeSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.agentType === agentType);
  }

  /**
   * Handle ACK timeout.
   */
  private async handleAckTimeout(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);

    if (!session || session.state !== 'hello_sent') {
      return;
    }

    console.warn(`[AgentHandshake] ACK timeout for ${agentId}`);

    session.state = 'failed';
    session.failedAt = new Date();
    session.failureReason = 'ACK timeout';

    await this.updateSession(session);

    this.pendingAcks.delete(agentId);

    this.emit('handshake:failed', { agentId, reason: 'ACK timeout' });
  }

  /**
   * Start heartbeat monitoring for an agent.
   */
  private startHeartbeat(agentId: string): void {
    // Clear existing interval
    const existing = this.heartbeatIntervals.get(agentId);
    if (existing) {
      clearInterval(existing);
    }

    this.missedHeartbeats.set(agentId, 0);

    const interval = setInterval(() => {
      this.checkHeartbeat(agentId);
    }, this.config.heartbeatIntervalMs);

    this.heartbeatIntervals.set(agentId, interval);
  }

  /**
   * Check heartbeat status for an agent.
   */
  private async checkHeartbeat(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);

    if (!session || session.state !== 'ready') {
      return;
    }

    const missed = (this.missedHeartbeats.get(agentId) || 0) + 1;
    this.missedHeartbeats.set(agentId, missed);

    if (missed >= this.config.maxMissedHeartbeats) {
      console.warn(`[AgentHandshake] Too many missed heartbeats for ${agentId}`);
      await this.disconnect(agentId, 'Heartbeat timeout');
    } else {
      this.emit('heartbeat:expected', { agentId, missed });
    }
  }

  /**
   * Load sessions from database.
   */
  private async loadSessions(): Promise<void> {
    const rows = await this.db.all<{
      agent_id: string;
      agent_type: string;
      session_id: string;
      state: string;
      capabilities: string | null;
      registered_at: string;
      last_heartbeat: string | null;
    }>(
      'SELECT * FROM active_agents WHERE state IN (?, ?)',
      ['pending', 'ready']
    );

    for (const row of rows) {
      const session: HandshakeSession = {
        id: row.session_id,
        agentId: row.agent_id,
        agentType: row.agent_type as AgentType,
        state: row.state === 'ready' ? 'ready' : 'pending',
        registeredAt: new Date(row.registered_at),
        capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
        metadata: undefined,
        lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
      };

      if (session.state === 'ready') {
        session.readyAt = session.registeredAt;
      }

      this.sessions.set(session.agentId, session);
    }
  }

  /**
   * Store session in database.
   */
  private async storeSession(session: HandshakeSession): Promise<void> {
    const now = new Date().toISOString();
    const assignedBot = session.agentType; // Use agent type as bot assignment

    await this.db.run(
      `INSERT INTO active_agents (agent_id, agent_type, session_id, state, assigned_bot, capabilities, registered_at, last_heartbeat, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent_id) DO UPDATE SET
         session_id = excluded.session_id,
         state = excluded.state,
         capabilities = excluded.capabilities,
         last_heartbeat = excluded.last_heartbeat,
         updated_at = excluded.updated_at`,
      [
        session.agentId,
        session.agentType,
        session.id,
        session.state,
        assignedBot,
        JSON.stringify(session.capabilities),
        session.registeredAt.toISOString(),
        now,
        now,
        now,
      ]
    );
  }

  /**
   * Update session in database.
   */
  private async updateSession(session: HandshakeSession): Promise<void> {
    const now = new Date().toISOString();

    await this.db.run(
      'UPDATE active_agents SET state = ?, last_heartbeat = ?, updated_at = ? WHERE agent_id = ?',
      [
        session.state,
        session.lastHeartbeat?.toISOString() ?? now,
        now,
        session.agentId,
      ]
    );
  }
}
