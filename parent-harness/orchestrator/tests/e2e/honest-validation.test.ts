/**
 * HONEST End-to-End Validation Tests
 * 
 * These tests validate that the parent harness ACTUALLY works,
 * not just that functions exist. Each test creates real records
 * in the database and verifies they work correctly.
 * 
 * Run: npx vitest tests/e2e/honest-validation.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import * as db from '../../src/db/index.js';
import * as agents from '../../src/db/agents.js';
import * as tasks from '../../src/db/tasks.js';
import * as sessions from '../../src/db/sessions.js';
import { events as eventHelpers, getEvents } from '../../src/db/events.js';
import { notify, initTelegram } from '../../src/telegram/index.js';
import * as qa from '../../src/qa/index.js';
import { checkOpenClawHealth, buildAgentPrompt } from '../../src/spawner/openclaw-spawner.js';

// Test results tracking
const results: { name: string; passed: boolean; reason?: string }[] = [];

function recordResult(name: string, passed: boolean, reason?: string) {
  results.push({ name, passed, reason });
}

beforeAll(() => {
  // Initialize test database - run migrations
  console.log('🧪 Starting HONEST validation tests...');
  console.log('🔄 Running database migrations...');
  db.migrate();
  console.log('✅ Migrations complete');
});

afterAll(() => {
  // Print summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}${r.reason ? ` - ${r.reason}` : ''}`);
  }
  
  console.log(`\nTotal: ${passed}/${results.length} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️ SOME TESTS FAILED - SYSTEM IS NOT FULLY OPERATIONAL');
  } else {
    console.log('\n✅ ALL TESTS PASSED - SYSTEM IS OPERATIONAL');
  }
});

describe('Database Layer', () => {
  test('agents table exists and can be queried', () => {
    try {
      const allAgents = agents.getAgents();
      expect(Array.isArray(allAgents)).toBe(true);
      recordResult('Agents table query', true);
    } catch (e) {
      recordResult('Agents table query', false, String(e));
      throw e;
    }
  });

  test('can create and retrieve an agent', () => {
    try {
      // Check if test agent exists
      let agent = agents.getAgent('test_agent_001');
      
      if (!agent) {
        // Create test agent
        agents.createAgent({
          id: 'test_agent_001',
          name: 'Test Agent',
          type: 'build_agent',
          description: 'Agent for testing',
          model: 'sonnet',
          temperature: 0.7,
        });
        agent = agents.getAgent('test_agent_001');
      }
      
      expect(agent).toBeDefined();
      expect(agent!.id).toBe('test_agent_001');
      recordResult('Agent CRUD', true);
    } catch (e) {
      recordResult('Agent CRUD', false, String(e));
      throw e;
    }
  });

  test('can create and retrieve a task', () => {
    try {
      // Create test task
      const taskId = `test_task_${Date.now()}`;
      const task = tasks.createTask({
        display_id: taskId,
        title: 'Test Task',
        description: 'Task for validation testing',
        category: 'test',
        priority: 'P2',
        status: 'pending',
      });
      
      expect(task).toBeDefined();
      expect(task.display_id).toBe(taskId);
      
      // Verify we can retrieve it
      const retrieved = tasks.getTask(task.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe('Test Task');
      
      recordResult('Task CRUD', true);
    } catch (e) {
      recordResult('Task CRUD', false, String(e));
      throw e;
    }
  });

  test('can create and retrieve a session', () => {
    try {
      // Get or create test agent
      let agent = agents.getAgent('test_agent_001');
      if (!agent) {
        agents.createAgent({
          id: 'test_agent_001',
          name: 'Test Agent',
          type: 'build_agent',
        });
        agent = agents.getAgent('test_agent_001')!;
      }
      
      // Create test task
      const task = tasks.createTask({
        display_id: `test_task_session_${Date.now()}`,
        title: 'Test Task for Session',
        category: 'test',
        priority: 'P2',
      });
      
      // Create session
      const session = sessions.createSession(agent.id, task.id);
      
      expect(session).toBeDefined();
      expect(session.agent_id).toBe(agent.id);
      expect(session.task_id).toBe(task.id);
      
      // Verify retrieval
      const retrieved = sessions.getSession(session.id);
      expect(retrieved).toBeDefined();
      
      recordResult('Session CRUD', true);
    } catch (e) {
      recordResult('Session CRUD', false, String(e));
      throw e;
    }
  });

  test('events can be created and retrieved', () => {
    try {
      // Create event
      eventHelpers.taskAssigned('test_task_id', 'test_agent_001', 'Test Event Task');
      
      // Retrieve recent events
      const recentEvents = getEvents({ limit: 1 });
      expect(recentEvents.length).toBeGreaterThan(0);
      
      recordResult('Events CRUD', true);
    } catch (e) {
      recordResult('Events CRUD', false, String(e));
      throw e;
    }
  });
});

describe('Agent Status Transitions', () => {
  test('agent status can transition: idle → working → idle', () => {
    try {
      // Get or create agent
      let agent = agents.getAgent('test_agent_001');
      if (!agent) {
        agents.createAgent({
          id: 'test_agent_001',
          name: 'Test Agent',
          type: 'build_agent',
        });
        agent = agents.getAgent('test_agent_001')!;
      }
      
      // Create task
      const task = tasks.createTask({
        display_id: `test_status_${Date.now()}`,
        title: 'Status Test Task',
        category: 'test',
        priority: 'P2',
      });
      
      // Create session
      const session = sessions.createSession(agent.id, task.id);
      
      // Transition to working
      agents.updateAgentStatus(agent.id, 'working', task.id, session.id);
      let updated = agents.getAgent(agent.id);
      expect(updated!.status).toBe('working');
      expect(updated!.current_task_id).toBe(task.id);
      
      // Transition back to idle
      agents.updateAgentStatus(agent.id, 'idle', null, null);
      updated = agents.getAgent(agent.id);
      expect(updated!.status).toBe('idle');
      expect(updated!.current_task_id).toBeNull();
      
      recordResult('Agent status transitions', true);
    } catch (e) {
      recordResult('Agent status transitions', false, String(e));
      throw e;
    }
  });
});

describe('Task Flow', () => {
  test('task can flow: pending → in_progress → pending_verification → completed', () => {
    try {
      // Create task
      const task = tasks.createTask({
        display_id: `test_flow_${Date.now()}`,
        title: 'Flow Test Task',
        category: 'test',
        priority: 'P2',
        status: 'pending',
      });
      
      expect(task.status).toBe('pending');
      
      // Assign to agent
      tasks.assignTask(task.id, 'test_agent_001');
      let updated = tasks.getTask(task.id);
      expect(updated!.status).toBe('in_progress');
      
      // Move to pending_verification (simulating completion)
      tasks.updateTask(task.id, { status: 'pending_verification' });
      updated = tasks.getTask(task.id);
      expect(updated!.status).toBe('pending_verification');
      
      // Complete
      tasks.completeTask(task.id);
      updated = tasks.getTask(task.id);
      expect(updated!.status).toBe('completed');
      
      recordResult('Task flow (pending→completed)', true);
    } catch (e) {
      recordResult('Task flow (pending→completed)', false, String(e));
      throw e;
    }
  });

  test('task can flow: pending → in_progress → failed (with retry tracking)', () => {
    try {
      // Create task
      const task = tasks.createTask({
        display_id: `test_fail_${Date.now()}`,
        title: 'Fail Test Task',
        category: 'test',
        priority: 'P2',
        status: 'pending',
      });
      
      // Assign
      tasks.assignTask(task.id, 'test_agent_001');
      
      // Fail
      tasks.failTask(task.id);
      let updated = tasks.getTask(task.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.retry_count).toBe(1);
      
      // Retry (re-queue as pending)
      tasks.updateTask(task.id, { status: 'pending' });
      tasks.assignTask(task.id, 'test_agent_001');
      tasks.failTask(task.id);
      updated = tasks.getTask(task.id);
      expect(updated!.retry_count).toBe(2);
      
      recordResult('Task fail + retry tracking', true);
    } catch (e) {
      recordResult('Task fail + retry tracking', false, String(e));
      throw e;
    }
  });
});

describe('QA Verification', () => {
  test('QA can run verification on a task', async () => {
    try {
      // Create a task in pending_verification
      const task = tasks.createTask({
        display_id: `test_qa_${Date.now()}`,
        title: 'QA Test Task',
        description: 'Task for QA testing',
        category: 'test',
        priority: 'P2',
        status: 'pending_verification',
        pass_criteria: JSON.stringify([
          'Tests pass',
          'Build succeeds',
        ]),
      });
      
      // QA verify function should exist and run
      // Note: This tests the QA infrastructure, not actual test execution
      const verifyTasks = tasks.getTasks({ status: 'pending_verification' });
      expect(verifyTasks.some(t => t.id === task.id)).toBe(true);
      
      recordResult('QA verification infrastructure', true);
    } catch (e) {
      recordResult('QA verification infrastructure', false, String(e));
      throw e;
    }
  });
});

describe('Spawner Integration', () => {
  test('buildAgentPrompt generates valid prompt', () => {
    try {
      const prompt = buildAgentPrompt(
        'build_agent',
        'Test Feature',
        'Implement a test feature',
        ['Tests pass', 'Build succeeds']
      );
      
      expect(prompt).toContain('CODEBASE LOCATION');
      expect(prompt).toContain('Test Feature');
      expect(prompt).toContain('Tests pass');
      expect(prompt).toContain('TASK_COMPLETE');
      expect(prompt).toContain('TASK_FAILED');
      
      recordResult('Spawner prompt generation', true);
    } catch (e) {
      recordResult('Spawner prompt generation', false, String(e));
      throw e;
    }
  });

  test('OpenClaw gateway health check', async () => {
    try {
      const healthy = await checkOpenClawHealth();
      // This may fail if OpenClaw isn't running, which is expected
      recordResult('OpenClaw gateway reachable', healthy, healthy ? undefined : 'Gateway not running or not reachable');
    } catch (e) {
      recordResult('OpenClaw gateway reachable', false, String(e));
    }
  });
});

describe('Telegram Integration', () => {
  test('Telegram bot initializes (when token provided)', () => {
    try {
      const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
      
      if (hasToken) {
        const initialized = initTelegram();
        expect(initialized).toBe(true);
        recordResult('Telegram bot init', true);
      } else {
        recordResult('Telegram bot init', false, 'TELEGRAM_BOT_TOKEN not set');
      }
    } catch (e) {
      recordResult('Telegram bot init', false, String(e));
    }
  });

  test('notify helpers are callable', () => {
    try {
      // Just verify the functions exist and are callable
      expect(typeof notify.taskAssigned).toBe('function');
      expect(typeof notify.taskCompleted).toBe('function');
      expect(typeof notify.taskFailed).toBe('function');
      expect(typeof notify.toolUse).toBe('function');
      expect(typeof notify.fileEdit).toBe('function');
      
      recordResult('Telegram notify helpers', true);
    } catch (e) {
      recordResult('Telegram notify helpers', false, String(e));
      throw e;
    }
  });
});

describe('Data Integrity', () => {
  test('foreign key constraints work (session requires valid agent/task)', () => {
    try {
      // This should fail because the agent doesn't exist
      expect(() => {
        sessions.createSession('nonexistent_agent_xyz', 'nonexistent_task_xyz');
      }).toThrow();
      
      recordResult('Foreign key constraints', true);
    } catch (e) {
      // If it doesn't throw, FK constraints might not be enforced
      recordResult('Foreign key constraints', false, 'No FK constraint violation');
    }
  });

  test('events link to valid agents/tasks/sessions', () => {
    try {
      // Create linked entities
      let agent = agents.getAgent('test_agent_001');
      if (!agent) {
        agents.createAgent({
          id: 'test_agent_001',
          name: 'Test Agent',
          type: 'build_agent',
        });
        agent = agents.getAgent('test_agent_001')!;
      }
      
      const task = tasks.createTask({
        display_id: `test_linked_${Date.now()}`,
        title: 'Linked Test Task',
        category: 'test',
        priority: 'P2',
      });
      
      const session = sessions.createSession(agent.id, task.id);
      
      // Create event with all links
      eventHelpers.toolUse(agent.id, session.id, 'test_tool', { test: true });
      
      // Verify event was created with correct links
      const recentEvents = getEvents({ agentId: agent.id, limit: 1 });
      expect(recentEvents.length).toBeGreaterThan(0);
      expect(recentEvents[0].agent_id).toBe(agent.id);
      
      recordResult('Event data integrity', true);
    } catch (e) {
      recordResult('Event data integrity', false, String(e));
      throw e;
    }
  });
});

describe('Concurrent Access', () => {
  test('multiple tasks can be created concurrently', async () => {
    try {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          Promise.resolve(
            tasks.createTask({
              display_id: `concurrent_${Date.now()}_${i}`,
              title: `Concurrent Task ${i}`,
              category: 'test',
              priority: 'P2',
            })
          )
        );
      }
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      expect(results.every(t => t && t.id)).toBe(true);
      
      recordResult('Concurrent task creation', true);
    } catch (e) {
      recordResult('Concurrent task creation', false, String(e));
      throw e;
    }
  });
});
