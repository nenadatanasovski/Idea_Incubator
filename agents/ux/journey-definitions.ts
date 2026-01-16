// agents/ux/journey-definitions.ts - Standard journey definitions

import { Journey } from "../../types/ux.js";

/**
 * Registry of all journeys (standard + custom)
 */
const journeyRegistry: Map<string, Journey> = new Map();

/**
 * Standard journeys for common flows
 */
export const STANDARD_JOURNEYS: Journey[] = [
  {
    id: "homepage-load",
    name: "Homepage Load",
    description: "Verify homepage loads correctly",
    startUrl: "http://localhost:5173",
    timeout: 30000,
    tags: ["smoke", "critical"],
    steps: [
      {
        action: "wait",
        target: "body",
        timeout: 5000,
        description: "Wait for body",
      },
      { action: "screenshot", description: "Homepage loaded" },
    ],
  },
  {
    id: "ideas-list",
    name: "Ideas List Navigation",
    description: "Navigate to ideas list and verify it loads",
    startUrl: "http://localhost:5173",
    timeout: 60000,
    tags: ["navigation", "ideas"],
    steps: [
      { action: "wait", target: "body", timeout: 5000 },
      {
        action: "click",
        target: '[data-testid="ideas-link"]',
        description: "Click ideas link",
      },
      { action: "wait", target: '[data-testid="ideas-list"]', timeout: 5000 },
      { action: "screenshot", description: "Ideas list" },
    ],
  },
  {
    id: "idea-detail",
    name: "Idea Detail View",
    description: "Navigate to an idea detail page",
    startUrl: "http://localhost:5173",
    timeout: 60000,
    tags: ["navigation", "ideas"],
    steps: [
      { action: "wait", target: "body", timeout: 5000 },
      { action: "click", target: '[data-testid="ideas-link"]' },
      { action: "wait", target: '[data-testid="ideas-list"]', timeout: 5000 },
      { action: "click", target: '[data-testid="idea-card"]:first-child' },
      { action: "wait", target: '[data-testid="idea-detail"]', timeout: 5000 },
      { action: "screenshot", description: "Idea detail" },
    ],
  },
  {
    id: "create-idea-form",
    name: "Create Idea Form",
    description: "Open and verify the create idea form",
    startUrl: "http://localhost:5173",
    timeout: 60000,
    tags: ["forms", "ideas"],
    steps: [
      { action: "wait", target: "body", timeout: 5000 },
      { action: "click", target: '[data-testid="create-idea-btn"]' },
      { action: "wait", target: '[data-testid="idea-form"]', timeout: 5000 },
      {
        action: "assert",
        target: '[data-testid="idea-title-input"]',
        value: "",
      },
      { action: "screenshot", description: "Create idea form" },
    ],
  },
  {
    id: "dashboard-overview",
    name: "Dashboard Overview",
    description: "Verify dashboard loads with key metrics",
    startUrl: "http://localhost:5173/dashboard",
    timeout: 60000,
    tags: ["dashboard", "critical"],
    steps: [
      { action: "wait", target: '[data-testid="dashboard"]', timeout: 5000 },
      {
        action: "wait",
        target: '[data-testid="metrics-panel"]',
        timeout: 5000,
      },
      { action: "screenshot", description: "Dashboard overview" },
    ],
  },
];

// Initialize registry with standard journeys
for (const journey of STANDARD_JOURNEYS) {
  journeyRegistry.set(journey.id, journey);
}

/**
 * Get a journey by ID
 */
export function getJourney(id: string): Journey | undefined {
  return journeyRegistry.get(id);
}

/**
 * Get all journeys with a specific tag
 */
export function getJourneysByTag(tag: string): Journey[] {
  return Array.from(journeyRegistry.values()).filter((journey) =>
    journey.tags?.includes(tag),
  );
}

/**
 * Get all registered journeys
 */
export function getAllJourneys(): Journey[] {
  return Array.from(journeyRegistry.values());
}

/**
 * Register a custom journey
 */
export function registerJourney(journey: Journey): void {
  journeyRegistry.set(journey.id, journey);
}

/**
 * Unregister a journey
 */
export function unregisterJourney(id: string): boolean {
  return journeyRegistry.delete(id);
}

/**
 * Check if a journey exists
 */
export function hasJourney(id: string): boolean {
  return journeyRegistry.has(id);
}

/**
 * Get journey IDs
 */
export function getJourneyIds(): string[] {
  return Array.from(journeyRegistry.keys());
}
