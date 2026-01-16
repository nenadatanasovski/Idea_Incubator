/**
 * Markdown Q&A Parser
 *
 * Parse Q&A pairs from development.md files.
 * Supports multiple formats with graceful fallback.
 */
import { client, useClaudeCli } from "../utils/anthropic-client.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logDebug, logWarning } from "../utils/logger.js";

export interface ParsedQA {
  question: string;
  answer: string;
  confidence: number;
}

/**
 * Parse Q&A from markdown with flexible pattern matching.
 * Tries multiple common formats used in development.md files.
 *
 * Supported formats:
 * - **Q:** question **A:** answer
 * - ### Question heading followed by answer
 * - Q: question / A: answer (simple format)
 * - Numbered questions: 1. Question? Answer text
 */
export function parseQAFromMarkdown(content: string): ParsedQA[] {
  const results: ParsedQA[] = [];
  const seen = new Set<string>();

  // Pattern 1: **Q:** / **A:** format (common in skills)
  const qaPattern1 =
    /\*\*Q:\s*(.+?)\*\*\s*\n+\s*(?:\*\*A:\*\*|A:)?\s*(.+?)(?=\n\*\*Q:|\n##|$)/gs;

  // Pattern 2: ### Question / Answer format (heading-based)
  const qaPattern2 =
    /###\s*(?:Question:?\s*)?(.+?)\n+(?:Answer:?\s*)?(.+?)(?=\n###|\n##(?!#)|$)/gs;

  // Pattern 3: Q: / A: simple format
  const qaPattern3 = /^Q:\s*(.+?)\n+A:\s*(.+?)(?=\nQ:|\n##|$)/gms;

  // Pattern 4: Numbered questions like "1. What is...? Answer"
  const qaPattern4 = /^\d+\.\s*(.+?\?)\s*\n+(.+?)(?=\n\d+\.|##|$)/gms;

  // Pattern 5: Bold question with answer below
  const qaPattern5 = /\*\*(.+?\??)\*\*\s*\n+(.+?)(?=\n\*\*|##|$)/gs;

  const patterns = [qaPattern1, qaPattern2, qaPattern3, qaPattern4, qaPattern5];

  for (const pattern of patterns) {
    // Reset regex lastIndex for each pattern
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      const question = match[1].trim();
      let answer = match[2].trim();

      // Clean up answer - remove trailing markdown artifacts
      answer = answer.replace(/\n\s*---\s*$/, "").trim();
      answer = answer.replace(/\n\s*\*\*[^*]+\*\*\s*$/, "").trim();

      // Skip if question is too short or looks like a heading
      if (question.length < 10) continue;

      // Skip if answer is too short
      if (answer.length < 10) continue;

      // Skip duplicates (normalize by lowercasing)
      const normalizedQ = question.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(normalizedQ)) continue;
      seen.add(normalizedQ);

      results.push({
        question,
        answer,
        confidence: 0.9, // High confidence for user-provided answers
      });
    }
  }

  return results;
}

/**
 * Extract Q&A using LLM when pattern matching yields few results.
 * This is a fallback for messy or inconsistent formats.
 *
 * @param content - The markdown content to parse
 * @param costTracker - Cost tracker instance for API usage
 * @returns Array of parsed Q&A pairs
 */
export async function extractQAWithLLM(
  content: string,
  costTracker: CostTracker,
): Promise<ParsedQA[]> {
  // Skip LLM extraction if using CLI (to avoid unexpected costs)
  if (useClaudeCli) {
    logWarning("Skipping LLM Q&A extraction (using Claude CLI)");
    return [];
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-3-5-20240307", // Use Haiku for cost efficiency
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Extract all question-answer pairs from this development notes document.
Look for:
- Explicit Q&A sections
- Headings that ask questions with content below
- Numbered questions with answers
- Any discussion where a question is posed and answered

Return as JSON array: [{"question": "...", "answer": "..."}]
Only include pairs where both question and answer are substantive (10+ characters each).

Document:
${content.substring(0, 8000)}`, // Limit context
        },
      ],
    });

    costTracker.track(response.usage, "qa-extraction");

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      logDebug("LLM extraction: No JSON array found in response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return parsed.map((p: { question: string; answer: string }) => ({
      question: p.question,
      answer: p.answer,
      confidence: 0.8, // Slightly lower confidence for LLM extraction
    }));
  } catch (error) {
    logWarning(`LLM Q&A extraction failed: ${error}`);
    return [];
  }
}

/**
 * Parse development.md file with fallback to LLM extraction.
 *
 * @param content - The markdown content to parse
 * @param costTracker - Optional cost tracker for LLM fallback
 * @param useLLMFallback - Whether to use LLM if pattern matching yields few results
 * @returns Array of parsed Q&A pairs
 */
export async function parseDevlopmentMd(
  content: string,
  costTracker?: CostTracker,
  useLLMFallback: boolean = true,
): Promise<ParsedQA[]> {
  // First, try pattern matching
  let qaPairs = parseQAFromMarkdown(content);

  logDebug(`Pattern matching found ${qaPairs.length} Q&A pairs`);

  // If pattern matching found few results but file has content, try LLM
  if (
    useLLMFallback &&
    qaPairs.length < 3 &&
    content.length > 500 &&
    costTracker
  ) {
    logDebug("Pattern matching yielded few results, trying LLM extraction...");
    const llmPairs = await extractQAWithLLM(content, costTracker);

    // Merge LLM pairs, avoiding duplicates
    const existingQuestions = new Set(
      qaPairs.map((p) => p.question.toLowerCase().replace(/\s+/g, " ")),
    );

    for (const pair of llmPairs) {
      const normalizedQ = pair.question.toLowerCase().replace(/\s+/g, " ");
      if (!existingQuestions.has(normalizedQ)) {
        qaPairs.push(pair);
        existingQuestions.add(normalizedQ);
      }
    }

    logDebug(`After LLM extraction: ${qaPairs.length} total Q&A pairs`);
  }

  return qaPairs;
}
