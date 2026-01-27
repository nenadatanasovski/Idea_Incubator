/**
 * Schema Public API
 *
 * This is the main entry point for the schema module.
 * Import types, schemas, and registry from here.
 */

// ============================================
// Database Connection
// ============================================

export { getDrizzleDb, resetDrizzleDb } from "./db.js";

// ============================================
// Schema Registry
// ============================================

export {
  schemaRegistry,
  getEntity,
  getEntityNames,
  getEnum,
  getEnumNames,
  getRelationshipsForEntity,
  type SchemaRegistry,
  type EntityMetadata,
} from "./registry.js";

// ============================================
// Entity Exports
// ============================================

// Idea
export {
  ideas,
  ideaTypes,
  lifecycleStages,
  insertIdeaSchema,
  selectIdeaSchema,
  updateIdeaSchema,
  type Idea,
  type NewIdea,
  type UpdateIdea,
  type IdeaType,
  type LifecycleStage,
} from "./entities/idea.js";

// Project
export {
  projects,
  projectStatuses,
  insertProjectSchema,
  selectProjectSchema,
  updateProjectSchema,
  type Project,
  type NewProject,
  type UpdateProject,
  type ProjectStatus,
} from "./entities/project.js";

// Task List
export {
  taskListsV2,
  taskListStatuses,
  insertTaskListSchema,
  selectTaskListSchema,
  updateTaskListSchema,
  type TaskList,
  type NewTaskList,
  type UpdateTaskList,
  type TaskListStatus,
} from "./entities/task-list.js";

// Task
export {
  tasks,
  taskStatuses,
  taskCategories,
  taskPriorities,
  taskEfforts,
  taskOwners,
  taskQueues,
  insertTaskSchema,
  selectTaskSchema,
  updateTaskSchema,
  type Task,
  type NewTask,
  type UpdateTask,
  type TaskCategory,
  type TaskStatus,
  type TaskPriority,
  type TaskEffort,
  type TaskOwner,
  type TaskQueue,
} from "./entities/task.js";

// Task Relationship
export {
  taskRelationships,
  relationshipTypes,
  insertTaskRelationshipSchema,
  selectTaskRelationshipSchema,
  createTaskRelationshipSchema,
  type TaskRelationship,
  type NewTaskRelationship,
  type CreateTaskRelationship,
  type RelationshipType,
} from "./entities/task-relationship.js";

// PRD
export {
  prds,
  prdStatuses,
  insertPrdSchema,
  selectPrdSchema,
  updatePrdSchema,
  type PRD,
  type NewPRD,
  type UpdatePRD,
  type PrdStatus,
} from "./entities/prd.js";

// Memory Block
export {
  memoryBlocks,
  blockTypes,
  blockStatuses,
  abstractionLevels,
  insertMemoryBlockSchema,
  selectMemoryBlockSchema,
  updateMemoryBlockSchema,
  type MemoryBlock,
  type NewMemoryBlock,
  type UpdateMemoryBlock,
  type BlockType,
  type BlockStatus,
  type AbstractionLevel,
} from "./entities/memory-block.js";

// Memory Link
export {
  memoryLinks,
  linkTypes,
  linkDegrees,
  linkStatuses,
  insertMemoryLinkSchema,
  selectMemoryLinkSchema,
  updateMemoryLinkSchema,
  type MemoryLink,
  type NewMemoryLink,
  type UpdateMemoryLink,
  type LinkType,
  type LinkDegree,
  type LinkStatus,
} from "./entities/memory-link.js";

// Memory Graph Membership
export {
  memoryGraphMemberships,
  graphTypes,
  insertMemoryGraphMembershipSchema,
  selectMemoryGraphMembershipSchema,
  type MemoryGraphMembership,
  type NewMemoryGraphMembership,
  type GraphType,
} from "./entities/memory-graph-membership.js";

// Memory Block Type
export {
  memoryBlockTypes,
  canonicalBlockTypes,
  insertMemoryBlockTypeSchema,
  selectMemoryBlockTypeSchema,
  type MemoryBlockType,
  type NewMemoryBlockType,
  type CanonicalBlockType,
} from "./entities/memory-block-type.js";

// Graph Snapshot
export {
  graphSnapshots,
  insertGraphSnapshotSchema,
  selectGraphSnapshotSchema,
  createGraphSnapshotSchema,
  type GraphSnapshot,
  type NewGraphSnapshot,
  type CreateGraphSnapshot,
  type GraphSnapshotData,
  type GraphSnapshotSummary,
} from "./entities/graph-snapshot.js";
