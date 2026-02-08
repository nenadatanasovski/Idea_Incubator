import { describe, test, expect, beforeAll } from "vitest";
import {
  mapSessionRowToSession,
  mapMessageRowToMessage,
  mapCandidateRowToCandidate,
} from "../../utils/ideation-mappers.js";
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from "../../utils/ideation-defaults.js";
import { getDb } from "../../database/db.js";
import type { Database as SqlJsDatabase } from "sql.js";

let db: SqlJsDatabase;

describe("Database Schema", () => {
  beforeAll(async () => {
    // Use the shared in-memory singleton. CHECK constraint violations in
    // sql.js throw errors but do not corrupt the database state since
    // SQLite rolls back the failed statement automatically.
    db = await getDb();
  });

  describe("ideation_sessions table", () => {
    test("PASS: Table exists after migration", async () => {
      const result = db.exec(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='ideation_sessions'
      `);
      expect(result.length).toBe(1);
      expect(result[0].values[0][0]).toBe("ideation_sessions");
    });

    test("PASS: Can insert valid session", async () => {
      const id = `test_session_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [id],
      );

      const result = db.exec(
        `SELECT * FROM ideation_sessions WHERE id = '${id}'`,
      );
      expect(result.length).toBe(1);

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [id]);
    });

    test("FAIL: Rejects invalid status", async () => {
      const id = `test_session_invalid_${Date.now()}`;

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
          VALUES (?, NULL, 'invalid_status', 'exploring')
        `,
          [id],
        );
      }).toThrow();
    });

    test("FAIL: Rejects invalid phase", async () => {
      const id = `test_session_invalid_phase_${Date.now()}`;

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
          VALUES (?, NULL, 'active', 'invalid_phase')
        `,
          [id],
        );
      }).toThrow();
    });
  });

  describe("ideation_messages table", () => {
    test("PASS: Table exists after migration", async () => {
      const result = db.exec(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='ideation_messages'
      `);
      expect(result.length).toBe(1);
    });

    test("PASS: Can insert valid message with JSON fields", async () => {
      const sessionId = `test_session_msg_${Date.now()}`;
      const messageId = `test_message_${Date.now()}`;

      // Create session first
      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      // Insert message with JSON
      const buttons = JSON.stringify([{ id: "btn1", label: "Option 1" }]);
      db.run(
        `
        INSERT INTO ideation_messages (id, session_id, role, content, buttons_shown)
        VALUES (?, ?, 'assistant', 'Hello', ?)
      `,
        [messageId, sessionId, buttons],
      );

      const result = db.exec(
        `SELECT buttons_shown FROM ideation_messages WHERE id = '${messageId}'`,
      );
      expect(JSON.parse(result[0].values[0][0] as string)).toEqual([
        { id: "btn1", label: "Option 1" },
      ]);

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    });

    test("PASS: Cascade delete removes messages when session deleted", async () => {
      const sessionId = `test_cascade_${Date.now()}`;
      const messageId = `test_cascade_msg_${Date.now()}`;

      // Enable foreign key constraints
      db.run(`PRAGMA foreign_keys = ON`);

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      db.run(
        `
        INSERT INTO ideation_messages (id, session_id, role, content)
        VALUES (?, ?, 'user', 'Test')
      `,
        [messageId, sessionId],
      );

      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);

      const result = db.exec(
        `SELECT * FROM ideation_messages WHERE id = '${messageId}'`,
      );
      expect(result.length).toBe(0);
    });
  });

  describe("ideation_candidates table", () => {
    test("PASS: Confidence must be 0-100", async () => {
      const sessionId = `test_session_cand_${Date.now()}`;
      const candidateId = `test_candidate_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      // Valid confidence
      db.run(
        `
        INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
        VALUES (?, ?, 'Test Idea', 75, 80, 'active')
      `,
        [candidateId, sessionId],
      );

      const result = db.exec(
        `SELECT confidence FROM ideation_candidates WHERE id = '${candidateId}'`,
      );
      expect(result[0].values[0][0]).toBe(75);

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    });

    test("FAIL: Rejects confidence > 100", async () => {
      const sessionId = `test_session_cand_invalid_${Date.now()}`;
      const candidateId = `test_candidate_invalid_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
          VALUES (?, ?, 'Test Idea', 150, 80, 'active')
        `,
          [candidateId, sessionId],
        );
      }).toThrow();

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    });

    test("FAIL: Rejects confidence < 0", async () => {
      const sessionId = `test_session_cand_neg_${Date.now()}`;
      const candidateId = `test_candidate_neg_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
          VALUES (?, ?, 'Test Idea', -10, 80, 'active')
        `,
          [candidateId, sessionId],
        );
      }).toThrow();

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    });
  });

  describe("ideation_viability_risks table", () => {
    test("PASS: Valid risk types accepted", async () => {
      const validTypes = [
        "impossible",
        "unrealistic",
        "too_complex",
        "too_vague",
        "saturated_market",
        "wrong_timing",
        "resource_mismatch",
      ];

      const sessionId = `test_session_risk_${Date.now()}`;
      const candidateId = `test_candidate_risk_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      db.run(
        `
        INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
        VALUES (?, ?, 'Test', 50, 50, 'active')
      `,
        [candidateId, sessionId],
      );

      for (const riskType of validTypes) {
        const riskId = `risk_${riskType}_${Date.now()}`;
        db.run(
          `
          INSERT INTO ideation_viability_risks (id, candidate_id, risk_type, description, severity)
          VALUES (?, ?, ?, 'Test description', 'medium')
        `,
          [riskId, candidateId, riskType],
        );

        const result = db.exec(
          `SELECT risk_type FROM ideation_viability_risks WHERE id = '${riskId}'`,
        );
        expect(result[0].values[0][0]).toBe(riskType);
      }

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    });

    test("FAIL: Invalid risk type rejected", async () => {
      const sessionId = `test_session_risk_invalid_${Date.now()}`;
      const candidateId = `test_candidate_risk_invalid_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      db.run(
        `
        INSERT INTO ideation_candidates (id, session_id, title, confidence, viability, status)
        VALUES (?, ?, 'Test', 50, 50, 'active')
      `,
        [candidateId, sessionId],
      );

      expect(() => {
        db.run(
          `
          INSERT INTO ideation_viability_risks (id, candidate_id, risk_type, description, severity)
          VALUES (?, ?, 'invalid_type', 'Test', 'medium')
        `,
          [`risk_invalid_${Date.now()}`, candidateId],
        );
      }).toThrow();

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    });
  });

  // Note: ideation_memory_files table is deprecated in favor of memory_blocks graph
  describe.skip("ideation_memory_files table (DEPRECATED)", () => {
    test("PASS: Unique constraint on session_id + file_type", async () => {
      const sessionId = `test_session_mem_${Date.now()}`;
      const memoryId1 = `memory_1_${Date.now()}`;
      const memoryId2 = `memory_2_${Date.now()}`;

      db.run(
        `
        INSERT INTO ideation_sessions (id, profile_id, status, current_phase)
        VALUES (?, NULL, 'active', 'exploring')
      `,
        [sessionId],
      );

      db.run(
        `
        INSERT INTO ideation_memory_files (id, session_id, file_type, content)
        VALUES (?, ?, 'self_discovery', '# Self Discovery')
      `,
        [memoryId1, sessionId],
      );

      // Second insert with same file_type should fail
      expect(() => {
        db.run(
          `
          INSERT INTO ideation_memory_files (id, session_id, file_type, content)
          VALUES (?, ?, 'self_discovery', '# Updated')
        `,
          [memoryId2, sessionId],
        );
      }).toThrow();

      // Cleanup
      db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
    });
  });
});

describe("Row Mappers", () => {
  describe("mapSessionRowToSession", () => {
    test("PASS: Maps all fields correctly", () => {
      const row = {
        id: "session_123",
        profile_id: "profile_456",
        entry_mode: "discover",
        status: "active",
        started_at: "2024-01-01T00:00:00.000Z",
        completed_at: null,
        last_activity_at: "2024-01-01T01:00:00.000Z",
        handoff_count: 0,
        token_count: 1000,
        message_count: 5,
        current_phase: "exploring",
        title: null,
      };

      const session = mapSessionRowToSession(row);

      expect(session.id).toBe("session_123");
      expect(session.profileId).toBe("profile_456");
      expect(session.entryMode).toBe("discover");
      expect(session.status).toBe("active");
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.completedAt).toBeNull();
      expect(session.handoffCount).toBe(0);
      expect(session.tokenCount).toBe(1000);
      expect(session.messageCount).toBe(5);
      expect(session.currentPhase).toBe("exploring");
    });

    test("PASS: Handles completed_at when present", () => {
      const row = {
        id: "session_123",
        profile_id: "profile_456",
        entry_mode: "have_idea",
        status: "completed",
        started_at: "2024-01-01T00:00:00.000Z",
        completed_at: "2024-01-01T02:00:00.000Z",
        last_activity_at: "2024-01-01T02:00:00.000Z",
        handoff_count: 1,
        token_count: 5000,
        message_count: 20,
        current_phase: "refining",
        title: "Test Session",
      };

      const session = mapSessionRowToSession(row);

      expect(session.completedAt).toBeInstanceOf(Date);
      expect(session.completedAt?.toISOString()).toBe(
        "2024-01-01T02:00:00.000Z",
      );
    });
  });

  describe("mapMessageRowToMessage", () => {
    test("PASS: Parses JSON fields correctly", () => {
      const row = {
        id: "msg_123",
        session_id: "session_456",
        role: "assistant",
        content: "Hello there",
        buttons_shown: JSON.stringify([
          { id: "btn1", label: "Click me", value: "clicked", style: "primary" },
        ]),
        button_clicked: null,
        form_shown: null,
        form_response: null,
        web_search_results: null,
        token_count: 50,
        created_at: "2024-01-01T00:00:00.000Z",
      };

      const message = mapMessageRowToMessage(row);

      expect(message.buttonsShown).toHaveLength(1);
      expect(message.buttonsShown![0].id).toBe("btn1");
      expect(message.formShown).toBeNull();
    });

    test("PASS: Handles null JSON fields", () => {
      const row = {
        id: "msg_123",
        session_id: "session_456",
        role: "user",
        content: "Hello",
        buttons_shown: null,
        button_clicked: null,
        form_shown: null,
        form_response: null,
        web_search_results: null,
        token_count: 10,
        created_at: "2024-01-01T00:00:00.000Z",
      };

      const message = mapMessageRowToMessage(row);

      expect(message.buttonsShown).toBeNull();
      expect(message.formShown).toBeNull();
      expect(message.formResponse).toBeNull();
    });
  });

  describe("mapCandidateRowToCandidate", () => {
    test("PASS: Converts SQLite boolean to JavaScript boolean", () => {
      const row = {
        id: "cand_123",
        session_id: "session_456",
        title: "Test Idea",
        summary: "A test idea",
        confidence: 75,
        viability: 80,
        user_suggested: 1, // SQLite true
        status: "active",
        captured_idea_id: null,
        version: 1,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T01:00:00.000Z",
      };

      const candidate = mapCandidateRowToCandidate(row);

      expect(candidate.userSuggested).toBe(true);
      expect(typeof candidate.userSuggested).toBe("boolean");
    });

    test("PASS: Handles user_suggested = 0 as false", () => {
      const row = {
        id: "cand_123",
        session_id: "session_456",
        title: "Test Idea",
        summary: null,
        confidence: 50,
        viability: 60,
        user_suggested: 0, // SQLite false
        status: "forming",
        captured_idea_id: null,
        version: 1,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      };

      const candidate = mapCandidateRowToCandidate(row);

      expect(candidate.userSuggested).toBe(false);
    });
  });
});

describe("Default State Factories", () => {
  describe("createDefaultSelfDiscoveryState", () => {
    test("PASS: Returns valid empty state", () => {
      const state = createDefaultSelfDiscoveryState();

      expect(state.impactVision.level).toBeNull();
      expect(state.frustrations).toEqual([]);
      expect(state.expertise).toEqual([]);
      expect(state.interests).toEqual([]);
      expect(state.skills.identified).toEqual([]);
      expect(state.skills.gaps).toEqual([]);
      expect(state.skills.strengths).toEqual([]);
      expect(state.constraints.location.fixed).toBe(false);
      expect(state.constraints.timeHoursPerWeek).toBeNull();
    });

    test("PASS: Each call returns new object", () => {
      const state1 = createDefaultSelfDiscoveryState();
      const state2 = createDefaultSelfDiscoveryState();

      expect(state1).not.toBe(state2);
      state1.frustrations.push({
        description: "test",
        source: "user",
        severity: "high",
      });
      expect(state2.frustrations).toHaveLength(0);
    });
  });

  describe("createDefaultMarketDiscoveryState", () => {
    test("PASS: Returns valid empty state", () => {
      const state = createDefaultMarketDiscoveryState();

      expect(state.competitors).toEqual([]);
      expect(state.gaps).toEqual([]);
      expect(state.timingSignals).toEqual([]);
      expect(state.failedAttempts).toEqual([]);
      expect(state.locationContext.city).toBeNull();
    });
  });

  describe("createDefaultNarrowingState", () => {
    test("PASS: Returns valid empty state with zero confidence", () => {
      const state = createDefaultNarrowingState();

      expect(state.productType.value).toBeNull();
      expect(state.productType.confidence).toBe(0);
      expect(state.customerType.value).toBeNull();
      expect(state.geography.value).toBeNull();
      expect(state.hypotheses).toEqual([]);
    });
  });
});
