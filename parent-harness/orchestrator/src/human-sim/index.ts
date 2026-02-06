/**
 * Human Simulation Agent
 * 
 * Simulates different human personas for testing:
 * - Technical: Detailed, knows the codebase
 * - Power-user: Advanced features, edge cases
 * - Casual: Basic usage, simple tasks
 * - Confused: Unclear requests, needs clarification
 * - Impatient: Quick responses, minimal detail
 */

import { query, run, getOne } from '../db/index.js';
import * as tasks from '../db/tasks.js';
import { v4 as uuidv4 } from 'uuid';

export type PersonaType = 'technical' | 'power_user' | 'casual' | 'confused' | 'impatient';

export interface Persona {
  type: PersonaType;
  name: string;
  description: string;
  traits: string[];
  responseStyle: {
    detailLevel: 'minimal' | 'moderate' | 'detailed';
    technicalLevel: 'low' | 'medium' | 'high';
    patienceLevel: 'low' | 'medium' | 'high';
    clarityLevel: 'low' | 'medium' | 'high';
  };
}

export interface SimulationRun {
  id: string;
  persona_type: PersonaType;
  task_id: string | null;
  scenario: string;
  inputs: string; // JSON array
  outputs: string; // JSON array
  status: 'running' | 'completed' | 'failed';
  issues_found: string | null; // JSON array
  created_at: string;
  completed_at: string | null;
}

// Persona definitions
export const PERSONAS: Record<PersonaType, Persona> = {
  technical: {
    type: 'technical',
    name: 'Alex (Technical)',
    description: 'Senior developer who knows the codebase well',
    traits: ['Specific', 'References code directly', 'Provides context', 'Expects detailed solutions'],
    responseStyle: {
      detailLevel: 'detailed',
      technicalLevel: 'high',
      patienceLevel: 'high',
      clarityLevel: 'high',
    },
  },
  power_user: {
    type: 'power_user',
    name: 'Sam (Power User)',
    description: 'Advanced user who pushes boundaries',
    traits: ['Edge cases', 'Performance focused', 'Advanced features', 'Integration scenarios'],
    responseStyle: {
      detailLevel: 'moderate',
      technicalLevel: 'medium',
      patienceLevel: 'medium',
      clarityLevel: 'high',
    },
  },
  casual: {
    type: 'casual',
    name: 'Jordan (Casual)',
    description: 'Regular user with basic needs',
    traits: ['Simple requests', 'Common use cases', 'Needs guidance', 'Appreciates examples'],
    responseStyle: {
      detailLevel: 'minimal',
      technicalLevel: 'low',
      patienceLevel: 'high',
      clarityLevel: 'medium',
    },
  },
  confused: {
    type: 'confused',
    name: 'Riley (Confused)',
    description: 'User who needs help articulating needs',
    traits: ['Vague requests', 'Contradictory requirements', 'Needs probing', 'Changes mind'],
    responseStyle: {
      detailLevel: 'minimal',
      technicalLevel: 'low',
      patienceLevel: 'medium',
      clarityLevel: 'low',
    },
  },
  impatient: {
    type: 'impatient',
    name: 'Casey (Impatient)',
    description: 'User who wants quick results',
    traits: ['Short responses', 'Wants immediate action', 'Skips details', 'Time-sensitive'],
    responseStyle: {
      detailLevel: 'minimal',
      technicalLevel: 'medium',
      patienceLevel: 'low',
      clarityLevel: 'medium',
    },
  },
};

// Ensure simulation table exists
function ensureSimulationTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS human_simulations (
      id TEXT PRIMARY KEY,
      persona_type TEXT NOT NULL,
      task_id TEXT,
      scenario TEXT NOT NULL,
      inputs TEXT NOT NULL,
      outputs TEXT NOT NULL,
      status TEXT DEFAULT 'running',
      issues_found TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `, []);
}

ensureSimulationTable();

/**
 * Get a persona by type
 */
export function getPersona(type: PersonaType): Persona {
  return PERSONAS[type];
}

/**
 * Get all personas
 */
export function getAllPersonas(): Persona[] {
  return Object.values(PERSONAS);
}

/**
 * Generate a simulated user input based on persona and context
 */
export function generateInput(
  persona: Persona,
  context: { task?: tasks.Task; scenario?: string }
): string {
  const { responseStyle } = persona;

  // This would normally call an LLM to generate realistic input
  // For now, return a template-based response

  if (context.task) {
    switch (persona.type) {
      case 'technical':
        return `I need to implement ${context.task.title}. Looking at the codebase, I think we should modify the relevant service layer. Can you provide a detailed implementation plan with specific file changes?`;
      
      case 'power_user':
        return `For ${context.task.title}, make sure it handles edge cases like concurrent access and large data sets. Also need to consider backwards compatibility.`;
      
      case 'casual':
        return `Can you help with ${context.task.title}? Not sure where to start.`;
      
      case 'confused':
        return `I think I need ${context.task.title}... or maybe something else? What do you recommend?`;
      
      case 'impatient':
        return `Just do ${context.task.title}. Need it ASAP.`;
    }
  }

  return context.scenario || 'How can I help?';
}

/**
 * Start a simulation run
 */
export function startSimulation(
  personaType: PersonaType,
  scenario: string,
  taskId?: string
): SimulationRun {
  const id = uuidv4();
  const persona = getPersona(personaType);
  const task = taskId ? tasks.getTask(taskId) : undefined;

  // Generate initial input
  const initialInput = generateInput(persona, { task, scenario });

  run(`
    INSERT INTO human_simulations (id, persona_type, task_id, scenario, inputs, outputs, status)
    VALUES (?, ?, ?, ?, ?, '[]', 'running')
  `, [id, personaType, taskId ?? null, scenario, JSON.stringify([initialInput])]);

  console.log(`🎭 Started simulation with ${persona.name}: ${scenario}`);

  return getSimulation(id)!;
}

/**
 * Add an interaction to a simulation
 */
export function addInteraction(
  simulationId: string,
  input: string,
  output: string
): SimulationRun | undefined {
  const sim = getSimulation(simulationId);
  if (!sim || sim.status !== 'running') return undefined;

  const inputs = JSON.parse(sim.inputs) as string[];
  const outputs = JSON.parse(sim.outputs) as string[];

  inputs.push(input);
  outputs.push(output);

  run(`
    UPDATE human_simulations 
    SET inputs = ?, outputs = ?
    WHERE id = ?
  `, [JSON.stringify(inputs), JSON.stringify(outputs), simulationId]);

  return getSimulation(simulationId);
}

/**
 * Complete a simulation
 */
export function completeSimulation(
  simulationId: string,
  issuesFound?: string[]
): SimulationRun | undefined {
  run(`
    UPDATE human_simulations 
    SET status = 'completed', 
        issues_found = ?,
        completed_at = datetime('now')
    WHERE id = ?
  `, [issuesFound ? JSON.stringify(issuesFound) : null, simulationId]);

  return getSimulation(simulationId);
}

/**
 * Get a simulation
 */
export function getSimulation(id: string): SimulationRun | undefined {
  return getOne<SimulationRun>('SELECT * FROM human_simulations WHERE id = ?', [id]);
}

/**
 * Get simulations
 */
export function getSimulations(filters?: {
  personaType?: PersonaType;
  status?: SimulationRun['status'];
  limit?: number;
}): SimulationRun[] {
  let sql = 'SELECT * FROM human_simulations WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.personaType) {
    sql += ' AND persona_type = ?';
    params.push(filters.personaType);
  }
  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return query<SimulationRun>(sql, params);
}

export default {
  PERSONAS,
  getPersona,
  getAllPersonas,
  generateInput,
  startSimulation,
  addInteraction,
  completeSimulation,
  getSimulation,
  getSimulations,
};
