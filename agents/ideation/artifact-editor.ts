/**
 * ARTIFACT EDITOR SUB-AGENT
 *
 * Dedicated agent for editing artifacts asynchronously.
 * Gets clean context with just the artifact and edit request.
 */

import { getConfig } from "../../config/index.js";
import { client as anthropicClient } from "../../utils/anthropic-client.js";
import { artifactStore } from "./artifact-store.js";

const ARTIFACT_EDITOR_SYSTEM_PROMPT = `You are an artifact editor. Your ONLY job is to edit artifact content based on user requests.

## INPUT FORMAT
You will receive:
1. The current artifact content
2. The user's edit request

## OUTPUT FORMAT
Use this EXACT format with delimiters (NOT JSON - JSON breaks with large content):

===STATUS===
SUCCESS
===SUMMARY===
Brief description of what you changed (1-2 sentences)
===CONTENT===
THE COMPLETE UPDATED ARTIFACT CONTENT GOES HERE
===END===

Or if the edit cannot be performed:

===STATUS===
ERROR
===SUMMARY===
Explanation of why the edit couldn't be performed
===END===

## RULES
1. Use the exact delimiter format above - do NOT use JSON
2. The CONTENT section must contain the COMPLETE updated artifact - not just the changes
3. Apply the user's requested changes to the existing content
4. Preserve all formatting, structure, and content that wasn't explicitly asked to change
5. Be precise - only change what was requested
6. Put the ENTIRE updated content between ===CONTENT=== and ===END===
`;

export interface ArtifactEditRequest {
  sessionId: string;
  artifactId: string;
  editRequest: string;
}

export interface ArtifactEditResult {
  success: boolean;
  artifactId: string;
  content?: string;
  summary?: string;
  error?: string;
}

/**
 * Edit an artifact using a dedicated sub-agent.
 * Runs asynchronously with clean context.
 */
export async function editArtifact(
  request: ArtifactEditRequest,
): Promise<ArtifactEditResult> {
  const { sessionId, artifactId, editRequest } = request;

  console.log(`[ArtifactEditor] Starting edit for artifact ${artifactId}`);
  console.log(`[ArtifactEditor] Edit request: "${editRequest}"`);

  // Load artifacts from database and find the one we need
  const artifacts = await artifactStore.getBySession(sessionId);
  const artifact = artifacts.find((a) => a.id === artifactId);

  if (!artifact) {
    console.error(
      `[ArtifactEditor] Artifact ${artifactId} not found in session ${sessionId}`,
    );
    return {
      success: false,
      artifactId,
      error: `Artifact ${artifactId} not found`,
    };
  }

  console.log(
    `[ArtifactEditor] Loaded artifact: "${artifact.title}" (${typeof artifact.content === "string" ? artifact.content.length : 0} chars)`,
  );

  // Prepare the content for the agent
  const artifactContent =
    typeof artifact.content === "string"
      ? artifact.content
      : JSON.stringify(artifact.content, null, 2);

  // Build the user message with artifact content and edit request
  const userMessage = `## CURRENT ARTIFACT CONTENT
Title: ${artifact.title}
Type: ${artifact.type}

\`\`\`
${artifactContent}
\`\`\`

## EDIT REQUEST
${editRequest}

Please apply the requested changes and return the complete updated content.`;

  try {
    // Call Claude with dedicated artifact editor context
    const response = await anthropicClient.messages.create({
      model: getConfig().model || "claude-opus-4-6",
      max_tokens: 16384, // Large limit for full artifact content
      system: ARTIFACT_EDITOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Parse response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        success: false,
        artifactId,
        error: "No text response from editor agent",
      };
    }

    const text = textContent.text;
    console.log(
      `[ArtifactEditor] Raw response (first 500 chars): ${text.slice(0, 500)}`,
    );

    // Parse delimiter-based response
    const statusMatch = text.match(/===STATUS===\s*(SUCCESS|ERROR)/i);
    const summaryMatch = text.match(
      /===SUMMARY===\s*([\s\S]*?)(?====CONTENT===|===END===)/,
    );
    const contentMatch = text.match(/===CONTENT===\s*([\s\S]*?)===END===/);

    if (!statusMatch) {
      console.error("[ArtifactEditor] Could not parse status from response");
      return {
        success: false,
        artifactId,
        error: "Could not parse editor response - missing STATUS",
      };
    }

    const status = statusMatch[1].toUpperCase();
    const summary = summaryMatch ? summaryMatch[1].trim() : "Edit completed";

    if (status === "ERROR") {
      return {
        success: false,
        artifactId,
        error: summary || "Edit failed",
      };
    }

    if (!contentMatch) {
      console.error("[ArtifactEditor] Could not parse content from response");
      return {
        success: false,
        artifactId,
        error: "Editor did not return updated content",
      };
    }

    const updatedContent = contentMatch[1].trim();

    console.log(
      `[ArtifactEditor] Edit successful, new content length: ${updatedContent.length}`,
    );
    console.log(`[ArtifactEditor] Summary: ${summary}`);

    // Save the updated artifact to database by re-saving with new content
    await artifactStore.save({
      id: artifactId,
      sessionId,
      type: artifact.type,
      title: artifact.title,
      content: updatedContent,
      identifier: artifact.identifier,
      status: "ready",
    });

    console.log(`[ArtifactEditor] Saved updated artifact to database`);

    return {
      success: true,
      artifactId,
      content: updatedContent,
      summary,
    };
  } catch (error) {
    console.error(`[ArtifactEditor] Error:`, error);
    return {
      success: false,
      artifactId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a user message is requesting an artifact edit.
 * Returns the artifact ID if found, null otherwise.
 */
export function detectArtifactEditRequest(
  message: string,
): { artifactId: string; editRequest: string } | null {
  // Look for @artifact:id references followed by edit-like language
  const artifactMatch = message.match(/@artifact:([a-zA-Z0-9_-]+)/);
  if (!artifactMatch) {
    return null;
  }

  const artifactId = artifactMatch[1];

  // Check if the message contains edit-related keywords
  const editKeywords = [
    "edit",
    "update",
    "change",
    "modify",
    "remove",
    "delete",
    "add",
    "fix",
    "correct",
    "revise",
    "adjust",
    "rewrite",
    "shorten",
    "expand",
    "summarize",
    "reformat",
    "clean up",
  ];

  const lowerMessage = message.toLowerCase();
  const hasEditKeyword = editKeywords.some((keyword) =>
    lowerMessage.includes(keyword),
  );

  if (!hasEditKeyword) {
    return null;
  }

  // Extract the edit request (the message without the artifact reference)
  const editRequest = message.replace(/@artifact:[a-zA-Z0-9_-]+/g, "").trim();

  return { artifactId, editRequest };
}
