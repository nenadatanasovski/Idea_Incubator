/**
 * Spec Session Agent
 *
 * Manages specification sessions with persistent state.
 * Implements the full session flow: start → answer questions → finalize.
 *
 * SPEC-002: Full session management implementation
 */

import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";
import {
  SpecSessionManager,
  SpecSession,
  Specification,
  SpecQuestion,
  SpecAnswer,
  TaskDefinition,
  Feature,
  IdeationToSpecHandoff,
  getSessionManager,
} from "./session-manager.js";
import { ClaudeClient } from "./claude-client.js";

// System prompts for spec generation
const SPEC_SYSTEM_PROMPT = `You are a software specification expert. Your job is to transform idea handoffs into comprehensive, actionable specifications.

When generating specifications:
1. Be precise and unambiguous
2. Focus on what needs to be built, not how
3. Identify all features and their acceptance criteria
4. Note constraints and assumptions
5. Flag areas that need clarification

Output format must be valid JSON matching the Specification interface.`;

const QUESTION_PROMPT = `Based on this specification draft, identify gaps or ambiguities that need clarification.
Focus on:
- Unclear feature requirements
- Missing edge cases
- Ambiguous scope boundaries
- Technical decisions needed

Return questions prioritized by importance (blocking, important, optional).`;

const REFINEMENT_PROMPT = `Given this answer to a specification question, update the specification accordingly.
Incorporate the new information naturally while maintaining consistency.
Return the updated specification as JSON.`;

export interface SpecSessionAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

export interface ChatIntent {
  type: "question_answer" | "spec_feedback" | "clarification" | "unknown";
  questionId?: string;
  confidence: number;
}

export interface ChatResult {
  response: string;
  updatedSpec: boolean;
  changes?: string[];
}

/**
 * SpecSessionAgent manages the full specification session lifecycle
 */
export class SpecSessionAgent extends EventEmitter {
  private sessionManager!: SpecSessionManager;
  private claudeClient: ClaudeClient;
  private initialized: boolean = false;

  constructor(config: SpecSessionAgentConfig = {}) {
    super();

    this.claudeClient = new ClaudeClient({
      apiKey: config.apiKey,
      model: config.model || "claude-opus-4-6",
      maxTokens: config.maxTokens,
    });
  }

  /**
   * Initialize the agent (lazy load session manager)
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.sessionManager = await getSessionManager();
      this.initialized = true;
    }
  }

  /**
   * Start a new specification session
   */
  async startSession(
    ideaId: string,
    handoff: IdeationToSpecHandoff,
  ): Promise<SpecSession> {
    await this.ensureInitialized();

    // Check for existing session
    const existing = await this.sessionManager.loadByIdeaId(ideaId);
    if (
      existing &&
      existing.status !== "complete" &&
      existing.status !== "failed"
    ) {
      // Return existing active session
      return existing;
    }

    // Create new session
    const session = await this.sessionManager.createSession(ideaId, handoff);

    try {
      // Generate initial spec draft
      const draft = await this.generateInitialDraft(handoff);
      session.currentDraft = draft;
      session.draftVersion = 1;

      // Identify gaps and questions
      const questions = await this.identifyGaps(draft, handoff);
      session.pendingQuestions = questions;

      // Update status based on questions
      session.status = questions.length > 0 ? "pending_input" : "active";

      // Save session
      await this.sessionManager.saveSession(session);

      // Emit event
      this.emit("sessionStarted", {
        sessionId: session.id,
        ideaId,
        questionCount: questions.length,
      });

      return session;
    } catch (error) {
      // Mark session as failed
      session.status = "failed";
      await this.sessionManager.saveSession(session);
      throw error;
    }
  }

  /**
   * Generate initial specification draft from handoff
   */
  private async generateInitialDraft(
    handoff: IdeationToSpecHandoff,
  ): Promise<Specification> {
    const prompt = this.buildDraftPrompt(handoff);

    const response = await this.claudeClient.complete({
      messages: [
        { role: "system", content: SPEC_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    try {
      // Extract JSON from response
      const jsonMatch =
        response.match(/```json\n?([\s\S]*?)\n?```/) ||
        response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("No valid JSON in response");
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const spec = JSON.parse(jsonStr) as Specification;

      // Ensure required fields
      return {
        version: spec.version || "1.0.0",
        overview: spec.overview || {
          name: handoff.ideaId,
          description: handoff.solutionDescription || "",
          problemStatement: handoff.problemStatement || "",
          targetUsers: handoff.targetUsers ? [handoff.targetUsers] : [],
        },
        features: spec.features || [],
        constraints: spec.constraints || [],
        assumptions: spec.assumptions || [],
        generatedFrom: handoff.ideaId,
        confidence: spec.confidence || 0.7,
      };
    } catch {
      // Return a basic spec if parsing fails
      return {
        version: "1.0.0",
        overview: {
          name: handoff.ideaId,
          description: handoff.solutionDescription || "Solution pending",
          problemStatement: handoff.problemStatement || "Problem pending",
          targetUsers: handoff.targetUsers ? [handoff.targetUsers] : [],
        },
        features: this.extractFeaturesFromHandoff(handoff),
        constraints: [],
        assumptions: [],
        generatedFrom: handoff.ideaId,
        confidence: 0.5,
      };
    }
  }

  /**
   * Build prompt for draft generation
   */
  private buildDraftPrompt(handoff: IdeationToSpecHandoff): string {
    return `Generate a software specification for the following idea:

## Problem Statement
${handoff.problemStatement || "Not specified"}

## Proposed Solution
${handoff.solutionDescription || "Not specified"}

## Target Users
${handoff.targetUsers || "Not specified"}

## Additional Context
${handoff.conversationSummary || "No additional context"}

## Artifacts
${handoff.artifacts.map((a) => `- ${a.type}: ${a.content}`).join("\n") || "None"}

Please generate a complete specification in JSON format matching this structure:
{
  "version": "1.0.0",
  "overview": {
    "name": "string",
    "description": "string",
    "problemStatement": "string",
    "targetUsers": ["string"]
  },
  "features": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "priority": "must-have" | "should-have" | "nice-to-have",
      "acceptanceCriteria": ["string"],
      "estimatedComplexity": "low" | "medium" | "high"
    }
  ],
  "constraints": [
    {
      "type": "technical" | "business" | "legal",
      "description": "string"
    }
  ],
  "assumptions": ["string"],
  "confidence": 0.0-1.0
}`;
  }

  /**
   * Extract features from handoff artifacts
   */
  private extractFeaturesFromHandoff(
    handoff: IdeationToSpecHandoff,
  ): Feature[] {
    const features: Feature[] = [];

    for (const artifact of handoff.artifacts) {
      if (
        artifact.type.includes("feature") ||
        artifact.type.includes("requirement")
      ) {
        features.push({
          id: `feat-${uuid().slice(0, 8)}`,
          name: artifact.content.slice(0, 50),
          description: artifact.content,
          priority: "should-have",
          acceptanceCriteria: [],
          estimatedComplexity: "medium",
        });
      }
    }

    // Ensure at least one feature
    if (features.length === 0) {
      features.push({
        id: "feat-core",
        name: "Core Functionality",
        description: "Main feature to be defined based on problem statement",
        priority: "must-have",
        acceptanceCriteria: ["Feature works as expected"],
        estimatedComplexity: "medium",
      });
    }

    return features;
  }

  /**
   * Identify gaps in the specification that need user input
   */
  private async identifyGaps(
    draft: Specification,
    handoff: IdeationToSpecHandoff,
  ): Promise<SpecQuestion[]> {
    const prompt = `${QUESTION_PROMPT}

Current Specification:
${JSON.stringify(draft, null, 2)}

Original Handoff:
${JSON.stringify(handoff, null, 2)}

Generate questions in JSON array format:
[
  {
    "id": "q-xxx",
    "question": "string",
    "context": "why this matters",
    "category": "feature" | "technical" | "scope" | "clarification",
    "priority": "blocking" | "important" | "optional"
  }
]`;

    try {
      const response = await this.claudeClient.complete({
        messages: [
          {
            role: "system",
            content:
              "You are a specification analyst. Identify gaps and ambiguities.",
          },
          { role: "user", content: prompt },
        ],
      });

      const jsonMatch =
        response.match(/```json\n?([\s\S]*?)\n?```/) ||
        response.match(/\[[\s\S]*\]/);

      if (!jsonMatch) return [];

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const questions = JSON.parse(jsonStr) as SpecQuestion[];

      // Add timestamps and ensure IDs
      return questions.map((q) => ({
        ...q,
        id: q.id || `q-${uuid().slice(0, 8)}`,
        createdAt: new Date(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Process user answer to a question
   */
  async answerQuestion(
    sessionId: string,
    questionId: string,
    answer: string,
  ): Promise<{ updated: boolean; remainingQuestions: number }> {
    await this.ensureInitialized();

    const session = await this.sessionManager.loadSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Find the question
    const questionIndex = session.pendingQuestions.findIndex(
      (q) => q.id === questionId,
    );
    if (questionIndex === -1) {
      throw new Error("Question not found");
    }

    const question = session.pendingQuestions[questionIndex];

    // Move to answered
    const answered: SpecAnswer = {
      ...question,
      answer,
      answeredAt: new Date(),
    };
    session.answeredQuestions.push(answered);
    session.pendingQuestions.splice(questionIndex, 1);

    // Refine spec with new answer
    if (session.currentDraft) {
      const refinedDraft = await this.refineSpecWithAnswer(
        session.currentDraft,
        question,
        answer,
      );
      session.currentDraft = refinedDraft;
      session.draftVersion++;
    }

    // Check if more questions needed
    if (session.pendingQuestions.length === 0 && session.currentDraft) {
      const newQuestions = await this.identifyGaps(
        session.currentDraft,
        session.handoffData!,
      );

      // Only add truly new questions (not similar to answered ones)
      const filteredQuestions = newQuestions.filter(
        (nq) =>
          !session.answeredQuestions.some((aq) =>
            aq.question
              .toLowerCase()
              .includes(nq.question.toLowerCase().slice(0, 20)),
          ),
      );

      if (filteredQuestions.length > 0) {
        session.pendingQuestions = filteredQuestions;
      } else {
        session.status = "active";
      }
    }

    await this.sessionManager.saveSession(session);

    return {
      updated: true,
      remainingQuestions: session.pendingQuestions.length,
    };
  }

  /**
   * Refine specification with user answer
   */
  private async refineSpecWithAnswer(
    draft: Specification,
    question: SpecQuestion,
    answer: string,
  ): Promise<Specification> {
    const prompt = `${REFINEMENT_PROMPT}

Current Specification:
${JSON.stringify(draft, null, 2)}

Question: ${question.question}
Context: ${question.context || "N/A"}
Category: ${question.category}

User's Answer: ${answer}

Return the updated specification as JSON, incorporating this new information.`;

    try {
      const response = await this.claudeClient.complete({
        messages: [
          {
            role: "system",
            content:
              "You are a specification editor. Update specs based on clarifications.",
          },
          { role: "user", content: prompt },
        ],
      });

      const jsonMatch =
        response.match(/```json\n?([\s\S]*?)\n?```/) ||
        response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) return draft;

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const updated = JSON.parse(jsonStr) as Specification;

      // Preserve metadata
      updated.version = draft.version;
      updated.generatedFrom = draft.generatedFrom;

      return updated;
    } catch {
      return draft;
    }
  }

  /**
   * Handle chat message during spec session
   */
  async chat(sessionId: string, message: string): Promise<ChatResult> {
    await this.ensureInitialized();

    const session = await this.sessionManager.loadSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Determine intent
    const intent = await this.classifyIntent(message, session);

    switch (intent.type) {
      case "question_answer":
        if (intent.questionId) {
          const result = await this.answerQuestion(
            sessionId,
            intent.questionId,
            message,
          );
          return {
            response: this.formatQuestionResponse(result, session),
            updatedSpec: true,
            changes: ["Incorporated answer into specification"],
          };
        }
        break;

      case "spec_feedback":
        const refined = await this.incorporateFeedback(session, message);
        return {
          response: `I've updated the specification based on your feedback. ${refined.changes.join(", ")}`,
          updatedSpec: true,
          changes: refined.changes,
        };

      case "clarification":
        return {
          response: await this.answerClarification(session, message),
          updatedSpec: false,
        };
    }

    return {
      response:
        "I'm not sure what you mean. Could you clarify? You can provide feedback on the spec, answer pending questions, or ask about specific features.",
      updatedSpec: false,
    };
  }

  /**
   * Classify user message intent
   */
  private async classifyIntent(
    message: string,
    session: SpecSession,
  ): Promise<ChatIntent> {
    // Check if answering a pending question
    for (const question of session.pendingQuestions) {
      // Simple heuristic: if message seems to answer the question
      const questionKeywords = question.question
        .toLowerCase()
        .split(" ")
        .slice(0, 5);
      const messageHasContext = questionKeywords.some((kw) =>
        message.toLowerCase().includes(kw),
      );

      if (messageHasContext || session.pendingQuestions.length === 1) {
        return {
          type: "question_answer",
          questionId: question.id,
          confidence: messageHasContext ? 0.8 : 0.6,
        };
      }
    }

    // Check for feedback keywords
    const feedbackKeywords = [
      "change",
      "update",
      "modify",
      "add",
      "remove",
      "should be",
      "instead",
    ];
    if (feedbackKeywords.some((kw) => message.toLowerCase().includes(kw))) {
      return { type: "spec_feedback", confidence: 0.7 };
    }

    // Check for question keywords
    const questionKeywords = [
      "what",
      "how",
      "why",
      "when",
      "where",
      "can you",
      "tell me",
    ];
    if (questionKeywords.some((kw) => message.toLowerCase().startsWith(kw))) {
      return { type: "clarification", confidence: 0.7 };
    }

    return { type: "unknown", confidence: 0.3 };
  }

  /**
   * Format response after answering a question
   */
  private formatQuestionResponse(
    result: { updated: boolean; remainingQuestions: number },
    session: SpecSession,
  ): string {
    if (result.remainingQuestions > 0) {
      const nextQ = session.pendingQuestions[0];
      return `Got it! I've updated the specification. I still have ${result.remainingQuestions} question(s):\n\n${nextQ?.question}`;
    }
    return "Thanks! All questions have been answered. The specification is now complete. You can finalize it to generate tasks.";
  }

  /**
   * Incorporate general feedback into spec
   */
  private async incorporateFeedback(
    session: SpecSession,
    feedback: string,
  ): Promise<{ changes: string[] }> {
    if (!session.currentDraft) {
      return { changes: [] };
    }

    const prompt = `Update this specification based on user feedback:

Current Specification:
${JSON.stringify(session.currentDraft, null, 2)}

User Feedback: ${feedback}

Return the updated specification as JSON, and list what changes you made.`;

    try {
      const response = await this.claudeClient.complete({
        messages: [
          {
            role: "system",
            content:
              "You are a specification editor. Incorporate feedback into specs.",
          },
          { role: "user", content: prompt },
        ],
      });

      const jsonMatch =
        response.match(/```json\n?([\s\S]*?)\n?```/) ||
        response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        session.currentDraft = JSON.parse(jsonStr);
        session.draftVersion++;
        await this.sessionManager.saveSession(session);
      }

      return { changes: ["Updated based on feedback"] };
    } catch {
      return { changes: [] };
    }
  }

  /**
   * Answer a clarification question about the spec
   */
  private async answerClarification(
    session: SpecSession,
    question: string,
  ): Promise<string> {
    if (!session.currentDraft) {
      return "No specification draft available yet.";
    }

    const prompt = `Based on this specification, answer the user's question:

Specification:
${JSON.stringify(session.currentDraft, null, 2)}

User Question: ${question}

Provide a helpful, concise answer.`;

    try {
      const response = await this.claudeClient.complete({
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant explaining specifications.",
          },
          { role: "user", content: prompt },
        ],
      });

      return response;
    } catch {
      return "I couldn't find a specific answer to that question.";
    }
  }

  /**
   * Finalize specification and generate tasks
   */
  async finalize(sessionId: string): Promise<{
    spec: Specification;
    tasks: TaskDefinition[];
  }> {
    await this.ensureInitialized();

    const session = await this.sessionManager.loadSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.pendingQuestions.length > 0) {
      throw new Error(
        `Cannot finalize: ${session.pendingQuestions.length} questions pending`,
      );
    }

    if (!session.currentDraft) {
      throw new Error("No specification draft available");
    }

    // Generate tasks from spec
    const tasks = await this.generateTasks(session.currentDraft);

    // Update session
    session.tasks = tasks;
    session.status = "complete";
    await this.sessionManager.saveSession(session);

    // Emit completion event
    this.emit("specComplete", {
      sessionId,
      ideaId: session.ideaId,
      taskCount: tasks.length,
    });

    return {
      spec: session.currentDraft,
      tasks,
    };
  }

  /**
   * Generate implementation tasks from specification
   */
  private async generateTasks(spec: Specification): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];

    for (const feature of spec.features) {
      // Database task if needed
      if (
        feature.description.toLowerCase().includes("store") ||
        feature.description.toLowerCase().includes("data") ||
        feature.description.toLowerCase().includes("persist")
      ) {
        tasks.push({
          id: `task-${uuid().slice(0, 8)}`,
          specId: spec.version,
          featureId: feature.id,
          name: `Database: ${feature.name}`,
          description: `Create database schema and migrations for ${feature.name}`,
          type: "database",
          dependencies: [],
          estimatedMinutes: this.complexityToMinutes(
            feature.estimatedComplexity,
          ),
          technicalDetails: `Schema for ${feature.name} feature`,
          testCriteria: [
            "Migration runs successfully",
            "Tables created correctly",
          ],
        });
      }

      // API task
      tasks.push({
        id: `task-${uuid().slice(0, 8)}`,
        specId: spec.version,
        featureId: feature.id,
        name: `API: ${feature.name}`,
        description: `Implement API endpoints for ${feature.name}`,
        type: "api",
        dependencies: tasks
          .filter((t) => t.type === "database" && t.featureId === feature.id)
          .map((t) => t.id),
        estimatedMinutes: this.complexityToMinutes(feature.estimatedComplexity),
        technicalDetails: `REST/GraphQL endpoints for ${feature.name}`,
        testCriteria: feature.acceptanceCriteria,
      });

      // UI task
      tasks.push({
        id: `task-${uuid().slice(0, 8)}`,
        specId: spec.version,
        featureId: feature.id,
        name: `UI: ${feature.name}`,
        description: `Build user interface for ${feature.name}`,
        type: "ui",
        dependencies: tasks
          .filter((t) => t.type === "api" && t.featureId === feature.id)
          .map((t) => t.id),
        estimatedMinutes:
          this.complexityToMinutes(feature.estimatedComplexity) * 1.5,
        technicalDetails: `React components for ${feature.name}`,
        testCriteria: ["Component renders correctly", "User interactions work"],
      });
    }

    // Add test task at the end
    tasks.push({
      id: `task-${uuid().slice(0, 8)}`,
      specId: spec.version,
      featureId: "all",
      name: "Integration Tests",
      description: "Write and run integration tests for all features",
      type: "test",
      dependencies: tasks.map((t) => t.id),
      estimatedMinutes: 60,
      technicalDetails: "End-to-end tests covering all features",
      testCriteria: ["All tests pass", "Coverage above 80%"],
    });

    return tasks;
  }

  /**
   * Convert complexity to estimated minutes
   */
  private complexityToMinutes(complexity: "low" | "medium" | "high"): number {
    switch (complexity) {
      case "low":
        return 30;
      case "medium":
        return 60;
      case "high":
        return 120;
      default:
        return 60;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SpecSession | null> {
    await this.ensureInitialized();
    return this.sessionManager.loadSession(sessionId);
  }

  /**
   * Get session by idea ID
   */
  async getSessionByIdeaId(ideaId: string): Promise<SpecSession | null> {
    await this.ensureInitialized();
    return this.sessionManager.loadByIdeaId(ideaId);
  }
}

// Singleton instance
let agentInstance: SpecSessionAgent | null = null;

export function getSpecSessionAgent(
  config?: SpecSessionAgentConfig,
): SpecSessionAgent {
  if (!agentInstance) {
    agentInstance = new SpecSessionAgent(config);
  }
  return agentInstance;
}

export function createSpecSessionAgent(
  config?: SpecSessionAgentConfig,
): SpecSessionAgent {
  return new SpecSessionAgent(config);
}
