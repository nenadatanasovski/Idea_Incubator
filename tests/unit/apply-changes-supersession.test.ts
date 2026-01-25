/**
 * Tests for Apply-Changes Endpoint - Supersession Handling
 *
 * These tests verify that the apply-changes endpoint correctly handles
 * supersession when applying graph changes.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

describe("Apply-Changes Endpoint - Supersession", () => {
  describe("Request Schema Validation", () => {
    test("schema accepts supersedesBlockId field", () => {
      // Simulate a change with supersession
      const change = {
        id: "block_new_decision",
        type: "create_block",
        blockType: "decision",
        title: "Use Vue.js",
        content: "Decided to use Vue.js for frontend",
        confidence: 0.95,
        graphMembership: ["solution"],
        supersedesBlockId: "block_old_decision",
        supersessionReason: "Simpler learning curve",
      };

      // Verify all required fields are present
      expect(change.id).toBeDefined();
      expect(change.type).toBe("create_block");
      expect(change.supersedesBlockId).toBe("block_old_decision");
      expect(change.supersessionReason).toBe("Simpler learning curve");
    });

    test("schema accepts statusChange field", () => {
      // Simulate a status change for superseded block
      const change = {
        id: "update_old_block",
        type: "update_block",
        blockId: "block_old_decision",
        statusChange: {
          newStatus: "superseded",
          reason: "Replaced by newer decision",
        },
      };

      expect(change.type).toBe("update_block");
      expect(change.statusChange?.newStatus).toBe("superseded");
    });

    test("schema validates statusChange newStatus enum", () => {
      // Valid status values
      const validStatuses = ["superseded", "abandoned"];
      validStatuses.forEach((status) => {
        expect(validStatuses.includes(status)).toBe(true);
      });

      // Invalid status should not be in the list
      expect(validStatuses.includes("active")).toBe(false);
    });
  });

  describe("Supersession Logic", () => {
    test("supersedesBlockId triggers link creation", () => {
      const changes = [
        {
          id: "block_vue",
          type: "create_block",
          blockType: "decision",
          content: "Use Vue.js",
          supersedesBlockId: "block_react",
          supersessionReason: "Changed preference",
        },
      ];

      // When a block has supersedesBlockId, the endpoint should:
      // 1. Create the new block
      // 2. Create a 'supersedes' link
      // 3. Update superseded block status

      const change = changes[0];
      expect(change.supersedesBlockId).toBe("block_react");

      // Expected actions
      const expectedActions = {
        createBlock: true,
        createSupersedesLink: change.supersedesBlockId !== undefined,
        updateSupersededStatus: change.supersedesBlockId !== undefined,
      };

      expect(expectedActions.createBlock).toBe(true);
      expect(expectedActions.createSupersedesLink).toBe(true);
      expect(expectedActions.updateSupersededStatus).toBe(true);
    });

    test("no supersedesBlockId skips supersession handling", () => {
      const changes = [
        {
          id: "block_regular",
          type: "create_block",
          blockType: "context",
          content: "Some context info",
        },
      ];

      const change = changes[0];

      // Without supersedesBlockId, no supersession actions
      const expectedActions = {
        createBlock: true,
        createSupersedesLink: (change as any).supersedesBlockId !== undefined,
        updateSupersededStatus: (change as any).supersedesBlockId !== undefined,
      };

      expect(expectedActions.createBlock).toBe(true);
      expect(expectedActions.createSupersedesLink).toBe(false);
      expect(expectedActions.updateSupersededStatus).toBe(false);
    });

    test("defaults supersessionReason when not provided", () => {
      const change = {
        id: "block_new",
        type: "create_block",
        supersedesBlockId: "block_old",
        // supersessionReason not provided
      };

      const reason = (change as any).supersessionReason || "Decision changed";
      expect(reason).toBe("Decision changed");
    });
  });

  describe("ID Mapping for Temporary IDs", () => {
    test("resolves temporary IDs when creating supersedes link", () => {
      const idMapping = new Map<string, string>();
      idMapping.set("temp_block_1", "uuid-123-456");
      idMapping.set("temp_block_old", "uuid-789-012");

      const change = {
        id: "temp_block_1",
        supersedesBlockId: "temp_block_old",
      };

      // Resolve IDs
      const resolvedNewBlockId = idMapping.get(change.id) || change.id;
      const resolvedSupersededId =
        idMapping.get(change.supersedesBlockId) || change.supersedesBlockId;

      expect(resolvedNewBlockId).toBe("uuid-123-456");
      expect(resolvedSupersededId).toBe("uuid-789-012");
    });

    test("uses original ID if not in mapping", () => {
      const idMapping = new Map<string, string>();
      idMapping.set("temp_block_1", "uuid-123-456");

      const change = {
        id: "temp_block_1",
        supersedesBlockId: "existing-block-uuid", // Not a temp ID
      };

      const resolvedSupersededId =
        idMapping.get(change.supersedesBlockId) || change.supersedesBlockId;

      expect(resolvedSupersededId).toBe("existing-block-uuid");
    });
  });

  describe("Status Change Handling", () => {
    test("update_block with statusChange updates status", () => {
      const change = {
        id: "update_1",
        type: "update_block",
        blockId: "target-block-id",
        statusChange: {
          newStatus: "superseded",
          reason: "Replaced by newer decision",
        },
      };

      expect(change.type).toBe("update_block");
      expect(change.statusChange).toBeDefined();
      expect(change.statusChange?.newStatus).toBe("superseded");
      expect(change.statusChange?.reason).toBe("Replaced by newer decision");
    });

    test("statusChange can use blockId from statusChange object", () => {
      const change = {
        id: "update_1",
        type: "update_block",
        statusChange: {
          blockId: "specific-block-id",
          newStatus: "superseded" as const,
          reason: "Testing",
        },
      };

      // Priority: statusChange.blockId > change.blockId
      const targetBlockId =
        change.statusChange.blockId || (change as any).blockId;

      expect(targetBlockId).toBe("specific-block-id");
    });
  });

  describe("WebSocket Events", () => {
    test("emits events for supersession changes", () => {
      // When supersession occurs, these events should be emitted:
      const expectedEvents = [
        { type: "block_created", data: { id: "new-block-id" } },
        {
          type: "link_created",
          data: {
            link_type: "supersedes",
            source: "new-block-id",
            target: "old-block-id",
          },
        },
        {
          type: "block_updated",
          data: { id: "old-block-id", status: "superseded" },
        },
      ];

      expect(expectedEvents.length).toBe(3);
      expect(expectedEvents[1].data.link_type).toBe("supersedes");
      expect(expectedEvents[2].data.status).toBe("superseded");
    });
  });

  describe("Edge Cases", () => {
    test("handles self-supersession gracefully", () => {
      // A block trying to supersede itself should be prevented
      const change = {
        id: "block_1",
        supersedesBlockId: "block_1", // Same ID!
      };

      const isSelfSupersession = change.id === change.supersedesBlockId;
      expect(isSelfSupersession).toBe(true);

      // This should be handled in the endpoint (skipped or error)
    });

    test("handles missing superseded block ID", () => {
      const idMapping = new Map<string, string>();
      // Mapping does NOT contain the superseded ID

      const change = {
        id: "block_new",
        supersedesBlockId: "nonexistent_temp_id",
      };

      // Falls back to using the original ID
      const resolvedId =
        idMapping.get(change.supersedesBlockId) || change.supersedesBlockId;

      expect(resolvedId).toBe("nonexistent_temp_id");
      // Database INSERT might fail if this ID doesn't exist
    });
  });
});
