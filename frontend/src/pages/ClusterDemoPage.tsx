/**
 * Idea Pyramid - Abstraction Level Navigation
 *
 * A knowledge interface that serves both humans and AI agents:
 *
 * For Humans:
 * - Navigate pyramid levels one at a time (Vision → Strategy → Tactic → Implementation)
 * - Toggle between Individual nodes and Grouped by theme views
 * - Block Type shapes based on graph membership (hexagon, diamond, circle, etc.)
 *
 * For Agents:
 * - Queryable structure for retrieving relevant context
 * - Node groups provide semantic clustering across abstraction levels
 *
 * Key Features:
 * - Single-level selector (one floor of the pyramid at a time)
 * - Node Group toggle (Individual vs Grouped view modes)
 * - Real data from API when session ID is provided
 * - Idea Node always visible as anchor point
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { GraphCanvas as ReagraphCanvas, GraphCanvasRef } from "reagraph";
// @ts-ignore - troika-three-text is a transitive dependency via reagraph
import { Text as TroikaText } from "troika-three-text";
import * as THREE from "three";
import type {
  GraphNode,
  GraphEdge,
  AbstractionLevel,
  ClusterStrategy,
  BlockType,
  GraphType,
  LinkType,
  NodeShape,
} from "../types/graph";
import { nodeShapes, nodeColors } from "../types/graph";

// Extended ClusterStrategy to include nodeGroup
type ExtendedClusterStrategy = ClusterStrategy | "nodeGroup";

// Data source type
type DataSource = "sample" | "api";

// API Block response type
interface APIBlock {
  id: string;
  sessionId: string;
  ideaId: string | null;
  type: string;
  blockTypes: string[];
  title: string | null;
  content: string;
  properties: Record<string, unknown>;
  status: string;
  confidence: number | null;
  abstractionLevel: string | null;
  graphMembership: string[];
  createdAt: string;
  updatedAt: string;
}

// API Link response type
interface APILink {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: string;
  properties: Record<string, unknown>;
  status: string;
}

// ============================================================================
// Types
// ============================================================================

interface IdeaNodeData extends GraphNode {
  isIdeaNode: true;
}

/**
 * NodeGroup: A semantic cluster of related memory blocks
 * Used for "Level 1" querying - showing themes instead of individual blocks
 */
interface NodeGroup {
  id: string;
  name: string;
  summary: string;
  theme: string;
  blockIds: string[]; // IDs of blocks in this group
  primaryGraphMembership: GraphType;
  dominantBlockTypes: BlockType[];
  keyInsights: string[];
  avgConfidence: number;
  // NodeGroups span abstraction levels - they're orthogonal
  abstractionLevelCounts: Partial<Record<AbstractionLevel, number>>;
}

/**
 * NodeGroupReport: AI-synthesized narrative for a NodeGroup
 */
interface NodeGroupReport {
  id: string;
  groupId: string;
  overview: string;
  story: string;
  openQuestions: string[];
  status: "current" | "stale";
}

// ============================================================================
// Constants
// ============================================================================

const ABSTRACTION_COLORS: Record<AbstractionLevel, string> = {
  vision: "#8B5CF6", // Purple
  strategy: "#3B82F6", // Blue
  tactic: "#22C55E", // Green
  implementation: "#F59E0B", // Amber
};

const ABSTRACTION_LABELS: Record<AbstractionLevel, string> = {
  vision: "Vision (Why)",
  strategy: "Strategy (How to win)",
  tactic: "Tactic (What to do)",
  implementation: "Implementation (How to do)",
};

// Block type shapes/icons (using different sizes for now, could be shapes)
const BLOCK_TYPE_STYLES: Partial<
  Record<BlockType, { size: number; opacity: number; border?: string }>
> &
  Record<string, { size: number; opacity: number; border?: string }> = {
  insight: { size: 8, opacity: 1 },
  decision: { size: 10, opacity: 1, border: "2px solid white" },
  fact: { size: 6, opacity: 0.9 },
  constraint: { size: 8, opacity: 1, border: "2px dashed white" },
  requirement: { size: 9, opacity: 1 },
  task: { size: 7, opacity: 0.85 },
  question: { size: 8, opacity: 0.9 },
  assumption: { size: 7, opacity: 0.8 },
  idea: { size: 20, opacity: 1, border: "3px solid #EC4899" }, // Special for Idea Node
  content: { size: 6, opacity: 0.7 },
};

// Graph type colors (for secondary clustering)
const GRAPH_TYPE_COLORS: Partial<Record<GraphType, string>> = {
  problem: "#EF4444", // Red
  solution: "#10B981", // Emerald
  market: "#F59E0B", // Amber
  risk: "#DC2626", // Red-600
  business: "#8B5CF6", // Purple
  spec: "#6366F1", // Indigo
  fit: "#14B8A6", // Teal
};

// NodeGroup colors (for nodeGroup clustering)
const NODE_GROUP_COLORS: Record<string, string> = {
  "ng-user-research": "#EC4899", // Pink
  "ng-tech-feasibility": "#06B6D4", // Cyan
  "ng-business-model": "#8B5CF6", // Purple
  "ng-hrt-therapy": "#10B981", // Emerald
  "ng-privacy-security": "#F59E0B", // Amber
};

// ============================================================================
// NodeGroups: Semantic Clusters (Orthogonal to Abstraction Levels)
// ============================================================================

const SAMPLE_NODE_GROUPS: NodeGroup[] = [
  {
    id: "ng-user-research",
    name: "User Research & Validation",
    summary:
      "Core insights from BFRB patient interviews and pain point analysis",
    theme: "User validation, market fit evidence",
    blockIds: ["v1", "s1", "t8", "i9"], // Blocks about user needs
    primaryGraphMembership: "problem",
    dominantBlockTypes: ["insight", "fact"],
    keyInsights: [
      "96% of BFRB patients lack access to HRT therapy",
      "High smartphone adoption among target demographic",
      "Biggest fear: shame and judgment from others",
    ],
    avgConfidence: 0.87,
    abstractionLevelCounts: {
      vision: 1,
      strategy: 1,
      tactic: 1,
      implementation: 1,
    },
  },
  {
    id: "ng-tech-feasibility",
    name: "Technical Feasibility",
    summary: "ML detection capabilities and platform implementation details",
    theme: "CoreML, real-time detection, iOS native",
    blockIds: ["s2", "t1", "t2", "i1", "i2", "i3"], // Tech blocks
    primaryGraphMembership: "spec",
    dominantBlockTypes: ["requirement", "task"],
    keyInsights: [
      "CoreML can achieve 85%+ accuracy for gesture detection",
      "On-device processing essential for privacy",
      "Camera access requires explicit user consent flow",
    ],
    avgConfidence: 0.82,
    abstractionLevelCounts: { strategy: 1, tactic: 2, implementation: 3 },
  },
  {
    id: "ng-business-model",
    name: "Business Model",
    summary: "Monetization strategy and unit economics",
    theme: "Freemium, subscriptions, pricing",
    blockIds: ["s3", "t5", "i7", "i8"], // Business blocks
    primaryGraphMembership: "business",
    dominantBlockTypes: ["decision", "requirement"],
    keyInsights: [
      "Freemium model with premium analytics",
      "Target $9.99/month subscription",
      "Stripe integration for payments",
    ],
    avgConfidence: 0.72,
    abstractionLevelCounts: { strategy: 1, tactic: 1, implementation: 2 },
  },
  {
    id: "ng-hrt-therapy",
    name: "HRT Therapy Modules",
    summary: "Habit Reversal Training implementation components",
    theme: "Awareness training, competing responses, intervention",
    blockIds: ["v2", "t3", "t4", "t7", "i5", "i6"], // HRT blocks
    primaryGraphMembership: "solution",
    dominantBlockTypes: ["requirement", "task"],
    keyInsights: [
      "Two core modules: Awareness + Competing Response",
      "Haptic feedback for real-time intervention",
      "Guided exercises for trigger recognition",
    ],
    avgConfidence: 0.85,
    abstractionLevelCounts: { vision: 1, tactic: 3, implementation: 2 },
  },
  {
    id: "ng-privacy-security",
    name: "Privacy & Data Security",
    summary: "Privacy-first architecture and data handling",
    theme: "On-device processing, data export, user control",
    blockIds: ["s4", "t6", "i4", "i11", "i12"], // Privacy blocks
    primaryGraphMembership: "spec",
    dominantBlockTypes: ["constraint", "requirement"],
    keyInsights: [
      "All processing on-device, no cloud storage",
      "User owns and can export all data",
      "Granular privacy controls in settings",
    ],
    avgConfidence: 0.92,
    abstractionLevelCounts: { strategy: 1, tactic: 1, implementation: 3 },
  },
];

// Sample NodeGroupReport for one group
const SAMPLE_NODE_GROUP_REPORT: NodeGroupReport = {
  id: "report-ng-user-research",
  groupId: "ng-user-research",
  overview:
    "The BFRB market represents a significant underserved population of 50M+ people globally. Our user research validates strong demand for a mobile-first, self-guided intervention tool.",
  story: `Users with Body-Focused Repetitive Behaviors experience significant shame and isolation.

Existing therapy options are geographically constrained and expensive ($100+/hour). Our research shows 96% of BFRB patients lack access to evidence-based treatment like Habit Reversal Training.

A mobile app providing real-time intervention through HRT techniques would directly address this gap. The target demographic shows high smartphone adoption (92%) and willingness to try digital health solutions.

Key insight: Users want a private, judgment-free way to manage their behaviors without needing to explain themselves to others.`,
  openQuestions: [
    "What's the optimal onboarding flow for a vulnerable health population?",
    "How do we balance intervention frequency vs user fatigue?",
    "Should we integrate with therapists or remain fully self-guided?",
  ],
  status: "current",
};

// Map block IDs to their NodeGroup
const BLOCK_TO_NODE_GROUP: Map<string, string> = new Map();
SAMPLE_NODE_GROUPS.forEach((group) => {
  group.blockIds.forEach((blockId) => {
    BLOCK_TO_NODE_GROUP.set(blockId, group.id);
  });
});

// ============================================================================
// The Idea Node - Central Anchor
// ============================================================================

const IDEA_NODE: IdeaNodeData = {
  id: "idea-root",
  label: "BFRB Companion App",
  title: "BFRB Companion App",
  blockType: "synthesis" as BlockType, // Idea node uses synthesis type
  graphMembership: ["problem", "solution"],
  status: "validated",
  confidence: 1.0,
  abstractionLevel: "vision",
  content:
    "A mobile app that helps people manage Body-Focused Repetitive Behaviors through real-time detection and Habit Reversal Training techniques.",
  properties: {},
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
  isIdeaNode: true,
};

// ============================================================================
// Sample Data: BFRB Companion App
// ============================================================================

const SAMPLE_NODES: GraphNode[] = [
  // VISION level (2 nodes) - connected to Idea Node
  {
    id: "v1",
    label: "Help 50M people manage BFRBs",
    title: "BFRB Vision",
    blockType: "insight",
    graphMembership: ["problem"],
    status: "validated",
    confidence: 0.95,
    abstractionLevel: "vision",
    content:
      "Our mission is to help 50 million people worldwide manage their body-focused repetitive behaviors through accessible, evidence-based technology.",
    properties: {},
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },
  {
    id: "v2",
    label: "Democratize HRT therapy",
    title: "Therapy Access",
    blockType: "insight",
    graphMembership: ["solution"],
    status: "validated",
    confidence: 0.9,
    abstractionLevel: "vision",
    content:
      "Make Habit Reversal Training accessible to everyone, regardless of their access to specialized therapists.",
    properties: {},
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
  },

  // STRATEGY level (4 nodes)
  {
    id: "s1",
    label: "Mobile-first self-guided app",
    title: "Mobile Strategy",
    blockType: "decision",
    graphMembership: ["solution"],
    status: "validated",
    confidence: 0.85,
    abstractionLevel: "strategy",
    content:
      "Build a mobile app that users can use independently without requiring therapist involvement.",
    properties: {},
    createdAt: "2024-01-02",
    updatedAt: "2024-01-02",
  },
  {
    id: "s2",
    label: "Real-time detection system",
    title: "Detection Strategy",
    blockType: "decision",
    graphMembership: ["solution", "spec"],
    status: "validated",
    confidence: 0.8,
    abstractionLevel: "strategy",
    content: "Use device sensors and ML to detect BFRB behaviors in real-time.",
    properties: {},
    createdAt: "2024-01-02",
    updatedAt: "2024-01-02",
  },
  {
    id: "s3",
    label: "Freemium monetization",
    title: "Business Model",
    blockType: "decision",
    graphMembership: ["business"],
    status: "active",
    confidence: 0.7,
    abstractionLevel: "strategy",
    content:
      "Free tier with basic features, premium subscription for advanced analytics and coaching.",
    properties: {},
    createdAt: "2024-01-02",
    updatedAt: "2024-01-02",
  },
  {
    id: "s4",
    label: "Privacy-first architecture",
    title: "Privacy Strategy",
    blockType: "constraint",
    graphMembership: ["spec", "risk"],
    status: "validated",
    confidence: 0.95,
    abstractionLevel: "strategy",
    content:
      "All sensitive data processed on-device. No video/audio stored on servers.",
    properties: {},
    createdAt: "2024-01-02",
    updatedAt: "2024-01-02",
  },

  // TACTIC level (8 nodes)
  {
    id: "t1",
    label: "iOS app with SwiftUI",
    title: "iOS Platform",
    blockType: "requirement",
    graphMembership: ["spec"],
    status: "active",
    confidence: 0.9,
    abstractionLevel: "tactic",
    content:
      "Build native iOS app using SwiftUI for optimal performance and platform integration.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
  {
    id: "t2",
    label: "CoreML vision model",
    title: "ML Detection",
    blockType: "requirement",
    graphMembership: ["spec"],
    status: "active",
    confidence: 0.85,
    abstractionLevel: "tactic",
    content: "Use CoreML for on-device ML inference for behavior detection.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
  {
    id: "t3",
    label: "Awareness training module",
    title: "HRT Module 1",
    blockType: "requirement",
    graphMembership: ["spec", "solution"],
    status: "active",
    confidence: 0.9,
    abstractionLevel: "tactic",
    content:
      "Help users recognize their triggers and urges through guided exercises.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
  {
    id: "t4",
    label: "Competing response toolkit",
    title: "HRT Module 2",
    blockType: "requirement",
    graphMembership: ["spec", "solution"],
    status: "active",
    confidence: 0.9,
    abstractionLevel: "tactic",
    content: "Provide alternative behaviors to replace the BFRB.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
  {
    id: "t5",
    label: "Stripe subscription integration",
    title: "Payments",
    blockType: "requirement",
    graphMembership: ["spec", "business"],
    status: "draft",
    confidence: 0.75,
    abstractionLevel: "tactic",
    content: "Use Stripe for subscription management and payment processing.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
  {
    id: "t6",
    label: "Local SQLite database",
    title: "Local Storage",
    blockType: "requirement",
    graphMembership: ["spec"],
    status: "active",
    confidence: 0.95,
    abstractionLevel: "tactic",
    content:
      "Store all user data locally in SQLite for privacy and offline access.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
  {
    id: "t7",
    label: "Haptic feedback system",
    title: "Intervention",
    blockType: "requirement",
    graphMembership: ["spec", "solution"],
    status: "active",
    confidence: 0.8,
    abstractionLevel: "tactic",
    content:
      "Use haptic feedback to gently alert users when behavior is detected.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },
  {
    id: "t8",
    label: "Daily check-in system",
    title: "Engagement",
    blockType: "requirement",
    graphMembership: ["spec", "solution"],
    status: "draft",
    confidence: 0.7,
    abstractionLevel: "tactic",
    content: "Daily prompts to track mood, triggers, and progress.",
    properties: {},
    createdAt: "2024-01-03",
    updatedAt: "2024-01-03",
  },

  // IMPLEMENTATION level (12 nodes)
  {
    id: "i1",
    label: "CameraManager class",
    title: "Camera API",
    blockType: "task",
    graphMembership: ["spec"],
    status: "active",
    confidence: 0.9,
    abstractionLevel: "implementation",
    content: "Implement camera access and frame capture for ML processing.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i2",
    label: "BFRBDetector model wrapper",
    title: "ML Wrapper",
    blockType: "task",
    graphMembership: ["spec"],
    status: "active",
    confidence: 0.85,
    abstractionLevel: "implementation",
    content: "CoreML model wrapper with preprocessing and postprocessing.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i3",
    label: "HapticEngine singleton",
    title: "Haptics",
    blockType: "task",
    graphMembership: ["spec"],
    status: "active",
    confidence: 0.9,
    abstractionLevel: "implementation",
    content: "Singleton for managing haptic feedback patterns.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i4",
    label: "SessionStore SQLite schema",
    title: "DB Schema",
    blockType: "task",
    graphMembership: ["spec"],
    status: "validated",
    confidence: 0.95,
    abstractionLevel: "implementation",
    content: "SQLite schema for storing session data locally.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i5",
    label: "AwarenessExerciseView",
    title: "Exercise UI",
    blockType: "task",
    graphMembership: ["spec"],
    status: "draft",
    confidence: 0.8,
    abstractionLevel: "implementation",
    content: "SwiftUI view for guided awareness exercises.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i6",
    label: "CompetingResponsePicker",
    title: "CR Picker",
    blockType: "task",
    graphMembership: ["spec"],
    status: "draft",
    confidence: 0.8,
    abstractionLevel: "implementation",
    content: "UI for selecting and customizing competing responses.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i7",
    label: "StripeManager class",
    title: "Stripe API",
    blockType: "task",
    graphMembership: ["spec", "business"],
    status: "draft",
    confidence: 0.7,
    abstractionLevel: "implementation",
    content: "Stripe SDK integration for iOS.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i8",
    label: "SubscriptionStore",
    title: "Sub State",
    blockType: "task",
    graphMembership: ["spec", "business"],
    status: "draft",
    confidence: 0.7,
    abstractionLevel: "implementation",
    content: "State management for subscription status.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i9",
    label: "DailyCheckInView",
    title: "Check-in UI",
    blockType: "task",
    graphMembership: ["spec"],
    status: "draft",
    confidence: 0.75,
    abstractionLevel: "implementation",
    content: "SwiftUI view for daily mood/trigger check-ins.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i10",
    label: "NotificationScheduler",
    title: "Notifications",
    blockType: "task",
    graphMembership: ["spec"],
    status: "draft",
    confidence: 0.8,
    abstractionLevel: "implementation",
    content: "Local notification scheduling for reminders.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i11",
    label: "PrivacySettingsView",
    title: "Privacy UI",
    blockType: "task",
    graphMembership: ["spec"],
    status: "active",
    confidence: 0.9,
    abstractionLevel: "implementation",
    content: "Settings UI for privacy controls and data management.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
  {
    id: "i12",
    label: "DataExportManager",
    title: "Export",
    blockType: "task",
    graphMembership: ["spec"],
    status: "draft",
    confidence: 0.85,
    abstractionLevel: "implementation",
    content: "Export user data in portable formats.",
    properties: {},
    createdAt: "2024-01-04",
    updatedAt: "2024-01-04",
  },
];

// All nodes including Idea Node
const ALL_NODES: GraphNode[] = [IDEA_NODE, ...SAMPLE_NODES];

const SAMPLE_EDGES: GraphEdge[] = [
  // Idea Node -> Vision
  {
    id: "e-idea-v1",
    source: "idea-root",
    target: "v1",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e-idea-v2",
    source: "idea-root",
    target: "v2",
    linkType: "implemented_by",
    status: "active",
  },

  // Vision -> Strategy
  {
    id: "e1",
    source: "v1",
    target: "s1",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e2",
    source: "v1",
    target: "s2",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e3",
    source: "v2",
    target: "s1",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e4",
    source: "v2",
    target: "s3",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e5",
    source: "v1",
    target: "s4",
    linkType: "constrained_by",
    status: "active",
  },

  // Strategy -> Tactic
  {
    id: "e6",
    source: "s1",
    target: "t1",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e7",
    source: "s2",
    target: "t2",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e8",
    source: "s2",
    target: "t3",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e9",
    source: "s2",
    target: "t4",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e10",
    source: "s3",
    target: "t5",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e11",
    source: "s4",
    target: "t6",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e12",
    source: "s2",
    target: "t7",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e13",
    source: "s1",
    target: "t8",
    linkType: "implemented_by",
    status: "active",
  },

  // Tactic -> Implementation
  {
    id: "e14",
    source: "t2",
    target: "i1",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e15",
    source: "t2",
    target: "i2",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e16",
    source: "t7",
    target: "i3",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e17",
    source: "t6",
    target: "i4",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e18",
    source: "t3",
    target: "i5",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e19",
    source: "t4",
    target: "i6",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e20",
    source: "t5",
    target: "i7",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e21",
    source: "t5",
    target: "i8",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e22",
    source: "t8",
    target: "i9",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e23",
    source: "t8",
    target: "i10",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e24",
    source: "t6",
    target: "i11",
    linkType: "implemented_by",
    status: "active",
  },
  {
    id: "e25",
    source: "t6",
    target: "i12",
    linkType: "implemented_by",
    status: "active",
  },

  // Cross-level constraints
  {
    id: "e26",
    source: "s4",
    target: "i11",
    linkType: "requires",
    status: "active",
  },
  {
    id: "e27",
    source: "t1",
    target: "i1",
    linkType: "requires",
    status: "active",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a node is the Idea Node
 */
function isIdeaNode(node: GraphNode): node is IdeaNodeData {
  return "isIdeaNode" in node && (node as IdeaNodeData).isIdeaNode === true;
}

/**
 * Filter nodes based on selected level, always including Idea Node
 * Single-level mode: only show nodes at the selected abstraction level
 */
function filterNodesBySelectedLevel(
  nodes: GraphNode[],
  selectedLevel: AbstractionLevel,
): GraphNode[] {
  return nodes.filter((node) => {
    // Idea Node is always visible
    if (isIdeaNode(node)) return true;

    // Check if node's abstraction level matches the selected level
    return node.abstractionLevel === selectedLevel;
  });
}

/**
 * Filter edges to only include those with both endpoints visible
 */
function filterEdgesByVisibility(
  edges: GraphEdge[],
  visibleNodeIds: Set<string>,
): GraphEdge[] {
  return edges.filter(
    (edge) =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
  );
}

// ============================================================================
// Custom Node Renderer for Shapes
// ============================================================================

/**
 * Custom node renderer for different shapes based on graph membership
 * Uses Three.js geometries to create distinct shapes for each graph type
 */
function CustomNodeRenderer({
  size,
  opacity,
  node,
  label,
}: {
  size: number;
  color: string;
  opacity: number;
  node: { shape?: NodeShape; fill?: string };
  label?: string;
}) {
  const shape = node.shape || "circle";
  const fillColor = node.fill || "#3B82F6";

  // Visual scale: make nodes appear larger without affecting layout spacing
  const visualSize = size * 2.0;
  const textSize = size * 1.0;

  // Create a star-shaped BufferGeometry with alternating outer/inner vertices
  const createStarGeometry = (
    outerRadius: number,
    points: number,
  ): THREE.BufferGeometry => {
    const innerRadius = outerRadius * 0.45;
    const totalPoints = points * 2;
    const vertices: number[] = [0, 0, 0]; // center
    for (let i = 0; i < totalPoints; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      vertices.push(Math.cos(angle) * r, Math.sin(angle) * r, 0);
    }
    const indices: number[] = [];
    for (let i = 1; i <= totalPoints; i++) {
      indices.push(0, i, i < totalPoints ? i + 1 : 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    return geo;
  };

  // Create a cross/plus-sign shaped BufferGeometry
  const createCrossGeometry = (radius: number): THREE.BufferGeometry => {
    const w = radius * 0.35; // arm width
    const l = radius; // arm length
    const vertices = [
      // Vertical bar
      -w,
      -l,
      0,
      w,
      -l,
      0,
      w,
      l,
      0,
      -w,
      l,
      0,
      // Horizontal bar
      -l,
      -w,
      0,
      l,
      -w,
      0,
      l,
      w,
      0,
      -l,
      w,
      0,
    ];
    const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    return geo;
  };

  // Create a pill/rounded-rectangle shaped BufferGeometry
  const createPillGeometry = (radius: number): THREE.BufferGeometry => {
    const hw = radius;
    const hh = radius * 0.55;
    const cr = hh;
    const segments = 8;
    const vertices: number[] = [0, 0, 0];
    const corners = [
      { cx: hw - cr, cy: hh - cr, startAngle: 0 },
      { cx: -(hw - cr), cy: hh - cr, startAngle: Math.PI / 2 },
      { cx: -(hw - cr), cy: -(hh - cr), startAngle: Math.PI },
      { cx: hw - cr, cy: -(hh - cr), startAngle: (3 * Math.PI) / 2 },
    ];
    for (const corner of corners) {
      for (let i = 0; i <= segments; i++) {
        const angle = corner.startAngle + (i / segments) * (Math.PI / 2);
        vertices.push(
          corner.cx + Math.cos(angle) * cr,
          corner.cy + Math.sin(angle) * cr,
          0,
        );
      }
    }
    const totalVerts = vertices.length / 3 - 1;
    const indices: number[] = [];
    for (let i = 1; i <= totalVerts; i++) {
      indices.push(0, i, i < totalVerts ? i + 1 : 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    return geo;
  };

  const getGeometryArgs = (): [number, number] | null => {
    switch (shape) {
      case "triangle":
        return [visualSize, 3];
      case "square":
        return [visualSize, 4];
      case "pentagon":
        return [visualSize, 5];
      case "hexagon":
        return [visualSize, 6];
      case "diamond":
        return [visualSize, 4];
      case "octagon":
        return [visualSize, 8];
      case "star":
      case "cross":
      case "pill":
        return null;
      case "circle":
      default:
        return [visualSize, 32];
    }
  };

  const getRotation = (): [number, number, number] => {
    switch (shape) {
      case "diamond":
        return [0, 0, 0];
      case "square":
        return [0, 0, Math.PI / 4];
      case "triangle":
        return [0, 0, -Math.PI / 2];
      default:
        return [0, 0, 0];
    }
  };

  const geometryArgs = getGeometryArgs();
  const rotation = getRotation();
  const customGeometry = useMemo(() => {
    if (shape === "star") return createStarGeometry(visualSize, 5);
    if (shape === "cross") return createCrossGeometry(visualSize);
    if (shape === "pill") return createPillGeometry(visualSize);
    return null;
  }, [shape, visualSize]);

  // Truncate label for display inside node
  const truncatedLabel =
    label && label.length > 60 ? label.substring(0, 57) + "..." : label;

  // Create troika text mesh for centered label inside node
  const textMesh = useMemo(() => {
    const t = new TroikaText();
    t.text = truncatedLabel || "";
    t.fontSize = textSize * 0.35;
    t.color = 0xffffff;
    t.anchorX = "center";
    t.anchorY = "middle";
    t.textAlign = "center";
    t.maxWidth = textSize * 2.4;
    t.outlineWidth = textSize * 0.04;
    t.outlineColor = 0x000000;
    t.position.z = 0.5;
    t.sync();
    return t;
  }, [truncatedLabel, textSize]);

  // Clean up troika text on unmount
  useEffect(() => {
    return () => {
      textMesh.dispose();
    };
  }, [textMesh]);

  return (
    <group>
      <group rotation={rotation}>
        <mesh>
          {customGeometry ? (
            <primitive object={customGeometry} attach="geometry" />
          ) : (
            <circleGeometry args={[geometryArgs![0], geometryArgs![1]]} />
          )}
          <meshBasicMaterial color={fillColor} opacity={opacity} transparent />
        </mesh>
      </group>
      {truncatedLabel && <primitive object={textMesh} />}
    </group>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function ClusterDemoPage() {
  const graphRef = useRef<GraphCanvasRef | null>(null);

  // ============================================================================
  // Data Source State (Sample vs API)
  // ============================================================================
  const [dataSource, setDataSource] = useState<DataSource>("sample");
  const [sessionId, setSessionId] = useState<string>(""); // User enters session ID
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiBlocks, setApiBlocks] = useState<APIBlock[]>([]);
  const [apiLinks, setApiLinks] = useState<APILink[]>([]);
  const [ideaTitle, setIdeaTitle] = useState<string>(""); // From API

  // Fetch data from API when sessionId changes
  useEffect(() => {
    if (dataSource !== "api" || !sessionId) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setApiError(null);

      try {
        // Fetch blocks
        const blocksRes = await fetch(
          `/api/ideation/session/${sessionId}/blocks`,
        );
        if (!blocksRes.ok) {
          throw new Error(`Failed to fetch blocks: ${blocksRes.status}`);
        }
        const blocksData = await blocksRes.json();
        if (blocksData.success && blocksData.data?.blocks) {
          setApiBlocks(blocksData.data.blocks);
        } else {
          setApiBlocks([]);
        }

        // Fetch links
        const linksRes = await fetch(
          `/api/ideation/session/${sessionId}/links`,
        );
        if (linksRes.ok) {
          const linksData = await linksRes.json();
          if (linksData.success && linksData.data?.links) {
            setApiLinks(linksData.data.links);
          } else {
            setApiLinks([]);
          }
        }

        // Fetch session info for title
        const sessionRes = await fetch(`/api/ideation/session/${sessionId}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.success && sessionData.data) {
            setIdeaTitle(
              sessionData.data.idea?.name ||
                sessionData.data.title ||
                "Unnamed Idea",
            );
          }
        }
      } catch (err) {
        setApiError(
          err instanceof Error ? err.message : "Failed to fetch data",
        );
        setApiBlocks([]);
        setApiLinks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dataSource, sessionId]);

  // Transform API blocks to GraphNode format
  const apiNodes: GraphNode[] = useMemo(() => {
    if (dataSource !== "api" || apiBlocks.length === 0) {
      return [];
    }

    return apiBlocks.map((block) => ({
      id: block.id,
      label: block.title || block.content.slice(0, 50) + "...",
      title: block.title || block.content.slice(0, 50),
      blockType: (block.blockTypes?.[0] ||
        block.type ||
        "content") as BlockType,
      graphMembership: (block.graphMembership || []) as GraphType[],
      status: block.status as
        | "draft"
        | "active"
        | "validated"
        | "superseded"
        | "abandoned",
      confidence: block.confidence || 0.5,
      abstractionLevel: (block.abstractionLevel ||
        "tactic") as AbstractionLevel,
      content: block.content,
      properties: block.properties,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    }));
  }, [dataSource, apiBlocks]);

  // Transform API links to GraphEdge format
  const apiEdges: GraphEdge[] = useMemo(() => {
    if (dataSource !== "api" || apiLinks.length === 0) {
      return [];
    }

    return apiLinks.map((link) => ({
      id: link.id,
      source: link.sourceId,
      target: link.targetId,
      linkType: link.linkType as LinkType,
      status: link.status as "active" | "superseded",
    }));
  }, [dataSource, apiLinks]);

  // Create Idea Node for API data
  const apiIdeaNode: IdeaNodeData | null = useMemo(() => {
    if (dataSource !== "api" || !ideaTitle) {
      return null;
    }

    return {
      id: "idea-root-api",
      label: ideaTitle,
      title: ideaTitle,
      blockType: "idea" as BlockType,
      graphMembership: ["problem", "solution"] as GraphType[],
      status: "validated" as const,
      confidence: 1.0,
      abstractionLevel: "vision" as AbstractionLevel,
      content: `Real data from session: ${sessionId}`,
      properties: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isIdeaNode: true as const,
    };
  }, [dataSource, ideaTitle, sessionId]);

  // Choose which data to use based on source
  const activeNodes = useMemo(() => {
    if (dataSource === "api" && apiNodes.length > 0) {
      return apiIdeaNode ? [apiIdeaNode, ...apiNodes] : apiNodes;
    }
    return ALL_NODES;
  }, [dataSource, apiNodes, apiIdeaNode]);

  const activeEdges = useMemo(() => {
    if (dataSource === "api") {
      return apiEdges;
    }
    return SAMPLE_EDGES;
  }, [dataSource, apiEdges]);

  // Build NodeGroup mapping from API data
  const apiNodeGroups = useMemo(() => {
    if (dataSource !== "api" || apiBlocks.length === 0) {
      return SAMPLE_NODE_GROUPS;
    }

    // Group blocks by their primary graphMembership to create automatic NodeGroups
    const groupedByGraph = new Map<string, APIBlock[]>();
    apiBlocks.forEach((block) => {
      const primaryGraph = block.graphMembership?.[0] || "ungrouped";
      if (!groupedByGraph.has(primaryGraph)) {
        groupedByGraph.set(primaryGraph, []);
      }
      groupedByGraph.get(primaryGraph)!.push(block);
    });

    const groups: NodeGroup[] = [];
    groupedByGraph.forEach((blocks, graphType) => {
      const abstractionCounts: Partial<Record<AbstractionLevel, number>> = {};
      blocks.forEach((b) => {
        const level = (b.abstractionLevel || "tactic") as AbstractionLevel;
        abstractionCounts[level] = (abstractionCounts[level] || 0) + 1;
      });

      const blockTypes = [
        ...new Set(blocks.flatMap((b) => b.blockTypes || [b.type])),
      ];

      groups.push({
        id: `ng-${graphType}`,
        name: `${graphType.charAt(0).toUpperCase() + graphType.slice(1)} Graph`,
        summary: `${blocks.length} blocks in ${graphType} dimension`,
        theme: graphType,
        blockIds: blocks.map((b) => b.id),
        primaryGraphMembership: graphType as GraphType,
        dominantBlockTypes: blockTypes.slice(0, 3) as BlockType[],
        keyInsights: blocks
          .slice(0, 3)
          .map((b) => b.title || b.content.slice(0, 50)),
        avgConfidence:
          blocks.reduce((sum, b) => sum + (b.confidence || 0.5), 0) /
          blocks.length,
        abstractionLevelCounts: abstractionCounts,
      });
    });

    return groups.length > 0 ? groups : SAMPLE_NODE_GROUPS;
  }, [dataSource, apiBlocks]);

  // Build block-to-nodegroup mapping for API data
  const apiBlockToNodeGroup = useMemo(() => {
    const map = new Map<string, string>();
    apiNodeGroups.forEach((group) => {
      group.blockIds.forEach((blockId) => {
        map.set(blockId, group.id);
      });
    });
    return map;
  }, [apiNodeGroups]);

  // ============================================================================
  // State
  // ============================================================================

  // Clustering state (extended to include nodeGroup)
  const [clusterStrategy, setClusterStrategy] =
    useState<ExtendedClusterStrategy>("graphMembership"); // Default to graph type clustering

  // Selected NodeGroup (for showing NodeGroupReport)
  const [selectedNodeGroup, setSelectedNodeGroup] = useState<NodeGroup | null>(
    null,
  );
  const [clusterStrength, setClusterStrength] = useState(0.7);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Single-level selector: one level visible at a time (pyramid metaphor)
  const [selectedLevel, setSelectedLevel] =
    useState<AbstractionLevel>("vision");

  // Node Group view mode: individual nodes vs grouped by theme
  type NodeGroupView = "individual" | "grouped";
  const [nodeGroupView, setNodeGroupView] =
    useState<NodeGroupView>("individual");

  // Stats - uses activeNodes (API or sample)
  const stats = useMemo(() => {
    const byLevel: Record<AbstractionLevel, number> = {
      vision: 0,
      strategy: 0,
      tactic: 0,
      implementation: 0,
    };
    activeNodes.forEach((n) => {
      if (n.abstractionLevel && !isIdeaNode(n)) {
        byLevel[n.abstractionLevel]++;
      }
    });
    return byLevel;
  }, [activeNodes]);

  // Filter nodes to show only selected level + Idea Node
  const visibleNodes = useMemo(() => {
    return filterNodesBySelectedLevel(activeNodes, selectedLevel);
  }, [activeNodes, selectedLevel]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(() => {
    return filterEdgesByVisibility(activeEdges, visibleNodeIds);
  }, [activeEdges, visibleNodeIds]);

  // When in "grouped" mode, use nodeGroup clustering automatically
  const effectiveClusterStrategy = useMemo(() => {
    if (nodeGroupView === "grouped") {
      return "nodeGroup" as ExtendedClusterStrategy;
    }
    return clusterStrategy;
  }, [nodeGroupView, clusterStrategy]);

  // Transform nodes for reagraph
  const reagraphNodes = useMemo(() => {
    return visibleNodes.map((node) => {
      const regularNode = node;
      const nodeIsIdeaNode = isIdeaNode(regularNode);
      const blockStyle = BLOCK_TYPE_STYLES[regularNode.blockType] ??
        BLOCK_TYPE_STYLES.content ?? { size: 6, opacity: 0.7 };

      // Determine cluster attribute based on effective strategy
      let cluster: string | undefined;
      if (effectiveClusterStrategy === "abstraction") {
        cluster = regularNode.abstractionLevel;
      } else if (effectiveClusterStrategy === "graphMembership") {
        cluster = regularNode.graphMembership[0];
      } else if (effectiveClusterStrategy === "blockType") {
        cluster = regularNode.blockType;
      } else if (effectiveClusterStrategy === "status") {
        cluster = regularNode.status;
      } else if (effectiveClusterStrategy === "nodeGroup") {
        // Cluster by semantic NodeGroup - use API or sample mapping
        const blockToGroup =
          dataSource === "api" ? apiBlockToNodeGroup : BLOCK_TO_NODE_GROUP;
        cluster = blockToGroup.get(regularNode.id) || "ungrouped";
      }

      // Get fill color based on effective strategy
      let fill: string;
      if (nodeIsIdeaNode) {
        fill = "#EC4899"; // Pink for Idea Node
      } else if (effectiveClusterStrategy === "graphMembership") {
        fill =
          GRAPH_TYPE_COLORS[regularNode.graphMembership[0] as GraphType] ||
          (regularNode.abstractionLevel
            ? ABSTRACTION_COLORS[regularNode.abstractionLevel]
            : "#6B7280");
      } else if (effectiveClusterStrategy === "blockType") {
        // Color by block type - use canonical nodeColors
        fill = nodeColors[regularNode.blockType] || "#6B7280";
      } else if (effectiveClusterStrategy === "nodeGroup") {
        // Color by NodeGroup - use API or sample mapping
        const blockToGroup =
          dataSource === "api" ? apiBlockToNodeGroup : BLOCK_TO_NODE_GROUP;
        const groupId = blockToGroup.get(regularNode.id);
        fill = groupId ? NODE_GROUP_COLORS[groupId] || "#6B7280" : "#9CA3AF"; // Gray for ungrouped
      } else {
        fill = regularNode.abstractionLevel
          ? ABSTRACTION_COLORS[regularNode.abstractionLevel]
          : "#6B7280";
      }

      // Get shape based on graph membership
      const primaryGraph = regularNode.graphMembership?.[0] as GraphType;
      const shape: NodeShape = nodeIsIdeaNode
        ? "star" // Idea node is always a star
        : nodeShapes[primaryGraph] || "circle";

      return {
        id: regularNode.id,
        label: regularNode.title || regularNode.label,
        subLabel: nodeIsIdeaNode
          ? "Central Idea"
          : `${regularNode.abstractionLevel} · ${regularNode.blockType}`,
        fill,
        size: nodeIsIdeaNode ? 20 : blockStyle.size,
        opacity: blockStyle.opacity,
        shape, // Different shape based on graph type
        data: regularNode,
        cluster: nodeIsIdeaNode ? undefined : cluster, // Idea Node doesn't cluster
      };
    });
  }, [visibleNodes, effectiveClusterStrategy, dataSource, apiBlockToNodeGroup]);

  const reagraphEdges = useMemo(() => {
    return visibleEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.linkType,
    }));
  }, [visibleEdges]);

  const clusterAttribute =
    effectiveClusterStrategy !== "none" ? "cluster" : undefined;

  // Handle node click
  const handleNodeClick = useCallback((node: any) => {
    const nodeData = node.data;
    setSelectedNode(nodeData as GraphNode);
  }, []);

  // Camera controls
  const handleFitView = useCallback(() => {
    graphRef.current?.fitNodesInView();
  }, []);

  const handleCenter = useCallback(() => {
    graphRef.current?.centerGraph();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Idea Pyramid</h1>
            <p className="text-sm text-gray-500 mt-1">
              Navigate abstraction levels, explore by theme, view shaped nodes
            </p>
          </div>

          {/* Data Source Selector */}
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setDataSource("sample")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  dataSource === "sample"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Sample Data
              </button>
              <button
                onClick={() => setDataSource("api")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  dataSource === "api"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                API Data
              </button>
            </div>

            {/* Session ID Input (only when API selected) */}
            {dataSource === "api" && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Enter session ID..."
                  className="px-3 py-1.5 text-sm border rounded-lg w-64"
                />
                {isLoading && (
                  <span className="text-sm text-gray-500">Loading...</span>
                )}
                {apiError && (
                  <span className="text-sm text-red-500">{apiError}</span>
                )}
                {!isLoading && !apiError && apiBlocks.length > 0 && (
                  <span className="text-sm text-green-600">
                    {apiBlocks.length} blocks loaded
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Show idea title when API data loaded */}
        {dataSource === "api" && ideaTitle && (
          <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-sm text-green-700">
              <strong>Viewing:</strong> {ideaTitle}
            </span>
            <span className="text-xs text-green-600 ml-2">
              ({apiBlocks.length} blocks, {apiEdges.length} links)
            </span>
          </div>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Controls */}
        <div className="w-96 bg-white border-r p-4 overflow-y-auto">
          {/* Abstraction Level Selector - Single level at a time (pyramid metaphor) */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Pyramid Level
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Navigate one level at a time
            </p>

            {/* Pyramid visualization */}
            <div className="relative mb-4">
              <div className="flex flex-col items-center gap-1">
                {(
                  ["vision", "strategy", "tactic", "implementation"] as const
                ).map((level, index) => {
                  const isSelected = selectedLevel === level;
                  const widthPercent = 40 + index * 20; // 40%, 60%, 80%, 100%

                  return (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className={`transition-all rounded-lg flex items-center justify-center ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-gray-900"
                          : "hover:opacity-80"
                      }`}
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: ABSTRACTION_COLORS[level],
                        opacity: isSelected ? 1 : 0.5,
                        padding: "8px 12px",
                      }}
                    >
                      <span className="text-white text-sm font-medium drop-shadow">
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </span>
                      <span className="text-white/80 text-xs ml-2">
                        ({stats[level]})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Level description */}
            <div className="p-3 rounded-lg border bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: ABSTRACTION_COLORS[selectedLevel] }}
                />
                <span className="text-sm font-medium text-gray-900">
                  {ABSTRACTION_LABELS[selectedLevel]}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                Showing {stats[selectedLevel]} nodes at this level
              </p>
            </div>
          </div>

          {/* Node Group View Toggle */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Node View
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setNodeGroupView("individual")}
                className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                  nodeGroupView === "individual"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Individual
              </button>
              <button
                onClick={() => setNodeGroupView("grouped")}
                className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                  nodeGroupView === "grouped"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                By Group
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {nodeGroupView === "individual"
                ? "Show all nodes individually"
                : "Cluster nodes by semantic theme"}
            </p>
          </div>

          {/* Advanced Clustering Options (only when in Individual mode) */}
          {nodeGroupView === "individual" && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Cluster By (Advanced)
              </h3>
              <select
                value={clusterStrategy}
                onChange={(e) =>
                  setClusterStrategy(e.target.value as ExtendedClusterStrategy)
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="none">None</option>
                <option value="graphMembership">
                  Graph Type (problem, solution, etc.)
                </option>
                <option value="blockType">
                  Block Type (insight, decision, etc.)
                </option>
                <option value="status">Status</option>
              </select>
              {clusterStrategy !== "none" && (
                <div className="mt-2">
                  <label className="text-xs text-gray-500">
                    Strength: {clusterStrength.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={clusterStrength}
                    onChange={(e) =>
                      setClusterStrength(parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {/* Idea Node Info */}
          <div className="mb-6 p-4 bg-pink-50 rounded-lg border border-pink-200">
            <h3 className="text-sm font-semibold text-pink-900 mb-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-pink-500" />
              Idea Node
            </h3>
            <p className="text-xs text-pink-700">
              <strong>{IDEA_NODE.title}</strong>
            </p>
            <p className="text-xs text-pink-600 mt-1 line-clamp-2">
              {IDEA_NODE.content}
            </p>
            <p className="text-xs text-pink-500 mt-2 italic">
              Always visible at all zoom levels
            </p>
          </div>

          {/* NodeGroups Panel - Shows semantic clusters */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              Node Groups
              <span className="text-xs font-normal text-gray-500">
                (orthogonal to abstraction)
              </span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(dataSource === "api" ? apiNodeGroups : SAMPLE_NODE_GROUPS).map(
                (group) => (
                  <button
                    key={group.id}
                    onClick={() =>
                      setSelectedNodeGroup(
                        selectedNodeGroup?.id === group.id ? null : group,
                      )
                    }
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      selectedNodeGroup?.id === group.id
                        ? "border-2 border-cyan-500 bg-cyan-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            NODE_GROUP_COLORS[group.id] || "#6B7280",
                        }}
                      />
                      <span className="text-xs font-medium text-gray-900">
                        {group.name}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {group.blockIds.length} blocks
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">
                      {group.summary}
                    </p>
                    {/* Show abstraction level distribution */}
                    <div className="flex gap-1 mt-2">
                      {(
                        [
                          "vision",
                          "strategy",
                          "tactic",
                          "implementation",
                        ] as const
                      ).map((level) => {
                        const count = group.abstractionLevelCounts[level] || 0;
                        return count > 0 ? (
                          <span
                            key={level}
                            className="text-[10px] px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: ABSTRACTION_COLORS[level] + "20",
                              color: ABSTRACTION_COLORS[level],
                            }}
                          >
                            {level.charAt(0).toUpperCase()}: {count}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </button>
                ),
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              NodeGroups span abstraction levels — they cluster by theme, not
              hierarchy
            </p>
          </div>

          {/* NodeGroupReport Preview */}
          {selectedNodeGroup && (
            <div className="mb-6 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-cyan-900">
                  NodeGroupReport
                </h3>
                <button
                  onClick={() => setSelectedNodeGroup(null)}
                  className="text-xs text-cyan-600 hover:text-cyan-800"
                >
                  Close
                </button>
              </div>
              <div className="text-xs text-cyan-800 font-medium mb-2">
                {selectedNodeGroup.name}
              </div>
              {selectedNodeGroup.id === "ng-user-research" ? (
                <>
                  <p className="text-xs text-cyan-700 mb-2">
                    {SAMPLE_NODE_GROUP_REPORT.overview}
                  </p>
                  <div className="text-xs text-cyan-600">
                    <strong>Open Questions:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {SAMPLE_NODE_GROUP_REPORT.openQuestions.map((q, i) => (
                        <li key={i} className="line-clamp-1">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-xs text-cyan-600 italic">
                  Report not yet generated. Click "Generate Report" to create AI
                  synthesis.
                </p>
              )}
              <div className="mt-3 pt-2 border-t border-cyan-200">
                <p className="text-[10px] text-cyan-500">
                  <strong>Key insight:</strong> NodeGroupReports synthesize
                  blocks across abstraction levels into narratives
                </p>
              </div>
            </div>
          )}

          {/* Current View Stats */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Current View
            </h3>
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
              <p>
                <strong>Level:</strong>{" "}
                <span style={{ color: ABSTRACTION_COLORS[selectedLevel] }}>
                  {selectedLevel.charAt(0).toUpperCase() +
                    selectedLevel.slice(1)}
                </span>
              </p>
              <p>
                <strong>Visible nodes:</strong> {reagraphNodes.length}
              </p>
              <p>
                <strong>Visible edges:</strong> {reagraphEdges.length}
              </p>
              <p>
                <strong>View mode:</strong>{" "}
                {nodeGroupView === "grouped"
                  ? "Grouped by theme"
                  : "Individual nodes"}
              </p>
            </div>
          </div>

          {/* Selected Node */}
          {selectedNode && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Selected Node
              </h3>
              <div className="p-3 bg-white border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{
                      backgroundColor: isIdeaNode(selectedNode)
                        ? "#EC4899"
                        : selectedNode.abstractionLevel
                          ? ABSTRACTION_COLORS[selectedNode.abstractionLevel]
                          : "#6B7280",
                    }}
                  />
                  <span className="font-medium text-gray-900">
                    {selectedNode.title || selectedNode.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    <strong>Level:</strong> {selectedNode.abstractionLevel}
                  </p>
                  <p>
                    <strong>Type:</strong> {selectedNode.blockType}
                  </p>
                  <p>
                    <strong>Graph:</strong>{" "}
                    {selectedNode.graphMembership.join(", ")}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedNode.status}
                  </p>
                </div>
                <p className="text-xs text-gray-600 mt-2 line-clamp-3">
                  {selectedNode.content}
                </p>
              </div>
            </div>
          )}

          {/* Camera Controls */}
          <div className="mb-6">
            <div className="flex gap-2">
              <button
                onClick={handleFitView}
                className="flex-1 px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
              >
                Fit View
              </button>
              <button
                onClick={handleCenter}
                className="flex-1 px-3 py-2 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500"
              >
                Center
              </button>
            </div>
          </div>
        </div>

        {/* Graph Canvas */}
        <div className="flex-1 relative">
          <ReagraphCanvas
            ref={graphRef}
            nodes={reagraphNodes}
            edges={reagraphEdges}
            onNodeClick={handleNodeClick}
            layoutType="forceDirected2d"
            clusterAttribute={clusterAttribute}
            layoutOverrides={{
              nodeStrength: -500,
              linkDistance: 100,
              clusterStrength: clusterAttribute ? clusterStrength : undefined,
            }}
            labelType="all"
            draggable
            animated
            cameraMode="pan"
            renderNode={({ size, color, opacity, node }) => (
              <CustomNodeRenderer
                size={size}
                color={color as string}
                opacity={opacity}
                node={node as { shape?: NodeShape; fill?: string }}
                label={(node as any).label || ""}
              />
            )}
            theme={
              {
                canvas: {
                  background: "#F9FAFB",
                },
                node: {
                  fill: "#3B82F6",
                  activeFill: "#2563EB",
                  opacity: 1,
                  selectedOpacity: 1,
                  inactiveOpacity: 0.3,
                  label: {
                    color: "#374151",
                    activeColor: "#1F2937",
                  },
                  subLabel: {
                    color: "#9CA3AF",
                    activeColor: "#6B7280",
                  },
                },
                edge: {
                  fill: "#D1D5DB",
                  activeFill: "#3B82F6",
                  opacity: 0.6,
                  selectedOpacity: 1,
                  inactiveOpacity: 0.2,
                  label: {
                    color: "#9CA3AF",
                    activeColor: "#374151",
                  },
                },
                arrow: {
                  fill: "#D1D5DB",
                  activeFill: "#3B82F6",
                },
                ring: {
                  fill: "#3B82F6",
                  activeFill: "#2563EB",
                },
                lasso: {
                  border: "#3B82F6",
                  background: "rgba(59, 130, 246, 0.1)",
                },
                cluster: {
                  stroke: "#CBD5E1",
                  fill: "rgba(241, 245, 249, 0.5)",
                  label: {
                    stroke: "#F1F5F9",
                    color: "#475569",
                  },
                },
              } as any
            }
          />

          {/* Current Level Indicator */}
          <div className="absolute top-4 left-4 bg-white px-4 py-3 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(
                  ["vision", "strategy", "tactic", "implementation"] as const
                ).map((level) => (
                  <div
                    key={level}
                    className={`w-3 h-3 rounded-full transition-all ${
                      level === selectedLevel
                        ? "ring-2 ring-gray-900 ring-offset-1"
                        : ""
                    }`}
                    style={{
                      backgroundColor: ABSTRACTION_COLORS[level],
                      opacity: level === selectedLevel ? 1 : 0.2,
                    }}
                    title={`${level}: ${level === selectedLevel ? "selected" : "hidden"}`}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-600">
                <span
                  className="font-medium"
                  style={{ color: ABSTRACTION_COLORS[selectedLevel] }}
                >
                  {selectedLevel.charAt(0).toUpperCase() +
                    selectedLevel.slice(1)}
                </span>
                <span className="ml-1">({stats[selectedLevel]} nodes)</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute top-4 right-4 bg-white px-4 py-3 rounded-lg shadow-sm border max-w-xs">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              {nodeGroupView === "grouped"
                ? "Node Groups"
                : effectiveClusterStrategy === "graphMembership"
                  ? "Graph Types"
                  : effectiveClusterStrategy === "blockType"
                    ? "Block Types"
                    : "Legend"}
            </div>
            <div className="flex flex-wrap gap-2">
              {nodeGroupView === "grouped" &&
                (dataSource === "api" ? apiNodeGroups : SAMPLE_NODE_GROUPS).map(
                  (group) => (
                    <div key={group.id} className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            NODE_GROUP_COLORS[group.id] || "#6B7280",
                        }}
                      />
                      <span className="text-xs text-gray-600">
                        {group.name.split(" ")[0]}
                      </span>
                    </div>
                  ),
                )}
              {nodeGroupView === "individual" &&
                effectiveClusterStrategy === "graphMembership" &&
                Object.entries(GRAPH_TYPE_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-gray-600">{type}</span>
                  </div>
                ))}
              {nodeGroupView === "individual" &&
                effectiveClusterStrategy === "blockType" &&
                (
                  [
                    "insight",
                    "fact",
                    "decision",
                    "question",
                    "assumption",
                    "requirement",
                    "task",
                    "constraint",
                  ] as const
                ).map((type) => (
                  <div key={type} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: nodeColors[type] }}
                    />
                    <span className="text-xs text-gray-600">{type}</span>
                  </div>
                ))}
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-pink-500" />
                <span className="text-xs text-gray-600">Idea Node</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur border px-4 py-3 rounded-lg">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-4">
                <span>
                  <strong>Scroll:</strong> Zoom
                </span>
                <span>
                  <strong>Drag:</strong> Pan
                </span>
                <span>
                  <strong>Click:</strong> Select node
                </span>
                <span>
                  <strong>Left panel:</strong> Navigate pyramid levels
                </span>
              </div>
              <div className="text-pink-600 font-medium">
                Pink star = Idea Node (always visible)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
