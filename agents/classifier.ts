/**
 * Classifier Agent
 * Auto-tags ideas and detects relationships between ideas
 */
import { client } from "../utils/anthropic-client.js";
import { query, run, saveDb } from "../database/db.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { EvaluationParseError } from "../utils/errors.js";
import { logDebug, logInfo } from "../utils/logger.js";
import { getConfig } from "../config/index.js";

export type IdeaDomain =
  | "business"
  | "creative"
  | "technical"
  | "personal"
  | "research";
export type RelationshipType =
  | "parent"
  | "child"
  | "related"
  | "combines"
  | "conflicts"
  | "inspired_by";
export type RelationshipStrength = "strong" | "medium" | "weak";

export interface IdeaRelationship {
  targetSlug: string;
  type: RelationshipType;
  strength: RelationshipStrength;
  reasoning: string;
}

export interface ClassificationTags {
  domain: IdeaDomain;
  tags: string[];
  relationships: IdeaRelationship[];
}

const CLASSIFIER_SYSTEM_PROMPT = `You classify ideas for organization and discovery.

Your job is to:
1. Determine the primary domain of the idea
2. Generate relevant tags (3-7 keywords)
3. Detect relationships to existing ideas

## Domains
- business: Commercial ventures, products, services, monetization
- creative: Art, design, content, entertainment
- technical: Engineering, software, hardware, systems
- personal: Self-improvement, lifestyle, hobbies
- research: Investigation, experimentation, learning

## Tags
- Use lowercase, hyphenated multi-word tags (e.g., "machine-learning")
- Include both broad and specific tags
- Consider: technology, industry, audience, approach, problem-type

## Relationships
- parent: This idea is a subset/component of target
- child: Target is a subset/component of this idea
- related: Ideas share domain or approach
- combines: This idea merges concepts from target
- conflicts: Ideas are mutually exclusive
- inspired_by: This idea builds on target

Respond in JSON:
{
  "domain": "...",
  "tags": ["tag1", "tag2"],
  "relationships": [
    {"targetSlug": "...", "type": "...", "strength": "strong|medium|weak", "reasoning": "..."}
  ]
}`;

/**
 * Classify an idea and detect relationships
 */
export async function classifyIdea(
  ideaContent: string,
  ideaSlug: string,
  costTracker: CostTracker,
): Promise<ClassificationTags> {
  const config = getConfig();

  // Get existing ideas for relationship detection
  const existingIdeas = await query<{
    slug: string;
    title: string;
    summary: string | null;
    idea_type: string | null;
  }>(
    "SELECT slug, title, summary, idea_type FROM ideas WHERE slug != ? ORDER BY updated_at DESC LIMIT 30",
    [ideaSlug],
  );

  const existingList = existingIdeas
    .map(
      (i) =>
        `- ${i.slug}: "${i.title}" [${i.idea_type || "untyped"}]${i.summary ? ` - ${i.summary}` : ""}`,
    )
    .join("\n");

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Classify this idea:

## Idea Content
${ideaContent}

## Current Idea Slug
${ideaSlug}

## Existing Ideas (for relationship detection)
${existingList || "(no existing ideas)"}

Provide classification with domain, tags, and any relationships.`,
      },
    ],
  });

  costTracker.track(response.usage, "classifier");
  logDebug(`Classified idea: ${ideaSlug}`);

  const content = response.content[0];
  if (content.type !== "text") {
    throw new EvaluationParseError("Unexpected response type from classifier");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError("Could not parse classifier JSON");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize
    return {
      domain: validateDomain(parsed.domain),
      tags: (parsed.tags || []).map((t: string) => t.toLowerCase().trim()),
      relationships: (parsed.relationships || []).map(validateRelationship),
    };
  } catch (error) {
    if (error instanceof EvaluationParseError) throw error;
    throw new EvaluationParseError(`Invalid classifier response: ${error}`);
  }
}

/**
 * Validate domain value
 */
function validateDomain(domain: string): IdeaDomain {
  const valid: IdeaDomain[] = [
    "business",
    "creative",
    "technical",
    "personal",
    "research",
  ];
  const normalized = domain?.toLowerCase().trim();
  return valid.includes(normalized as IdeaDomain)
    ? (normalized as IdeaDomain)
    : "technical";
}

/**
 * Validate relationship object
 */
function validateRelationship(rel: any): IdeaRelationship {
  const validTypes: RelationshipType[] = [
    "parent",
    "child",
    "related",
    "combines",
    "conflicts",
    "inspired_by",
  ];
  const validStrengths: RelationshipStrength[] = ["strong", "medium", "weak"];

  return {
    targetSlug: rel.targetSlug || "",
    type: validTypes.includes(rel.type) ? rel.type : "related",
    strength: validStrengths.includes(rel.strength) ? rel.strength : "medium",
    reasoning: rel.reasoning || "",
  };
}

/**
 * Save classification to database
 */
export async function saveClassification(
  ideaId: string,
  classification: ClassificationTags,
): Promise<void> {
  logInfo(`Saving classification for idea ${ideaId}`);

  // Update idea type
  await run("UPDATE ideas SET idea_type = ? WHERE id = ?", [
    classification.domain,
    ideaId,
  ]);

  // Add tags
  for (const tagName of classification.tags) {
    // Insert tag if not exists
    await run("INSERT OR IGNORE INTO tags (name) VALUES (?)", [tagName]);

    // Get tag id
    const tag = await query<{ id: number }>(
      "SELECT id FROM tags WHERE name = ?",
      [tagName],
    );

    if (tag.length > 0) {
      // Link to idea
      await run(
        "INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)",
        [ideaId, tag[0].id],
      );
    }
  }

  // Add relationships
  for (const rel of classification.relationships) {
    const targetIdea = await query<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [rel.targetSlug],
    );

    if (targetIdea.length > 0) {
      await run(
        `INSERT OR REPLACE INTO idea_relationships
         (source_idea_id, target_idea_id, relationship_type, strength, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [ideaId, targetIdea[0].id, rel.type, rel.strength, rel.reasoning],
      );
    }
  }

  await saveDb();
  logDebug(`Classification saved for ${ideaId}`);
}

/**
 * Get tags for an idea
 */
export async function getIdeaTags(ideaId: string): Promise<string[]> {
  const tags = await query<{ name: string }>(
    `SELECT t.name FROM tags t
     JOIN idea_tags it ON t.id = it.tag_id
     WHERE it.idea_id = ?`,
    [ideaId],
  );
  return tags.map((t) => t.name);
}

/**
 * Get relationships for an idea
 */
export async function getIdeaRelationships(ideaId: string): Promise<
  Array<{
    targetSlug: string;
    targetTitle: string;
    type: RelationshipType;
    strength: RelationshipStrength;
    notes: string;
  }>
> {
  const relationships = await query<{
    target_slug: string;
    target_title: string;
    relationship_type: string;
    strength: string;
    notes: string;
  }>(
    `SELECT
      i.slug as target_slug,
      i.title as target_title,
      ir.relationship_type,
      ir.strength,
      ir.notes
     FROM idea_relationships ir
     JOIN ideas i ON i.id = ir.target_idea_id
     WHERE ir.source_idea_id = ?`,
    [ideaId],
  );

  return relationships.map((r) => ({
    targetSlug: r.target_slug,
    targetTitle: r.target_title,
    type: r.relationship_type as RelationshipType,
    strength: r.strength as RelationshipStrength,
    notes: r.notes || "",
  }));
}

/**
 * Find ideas with similar tags
 */
export async function findSimilarIdeas(
  ideaId: string,
  limit: number = 5,
): Promise<
  Array<{
    slug: string;
    title: string;
    sharedTags: string[];
    score: number;
  }>
> {
  // Get this idea's tags
  const myTags = await getIdeaTags(ideaId);
  if (myTags.length === 0) return [];

  // Find ideas with overlapping tags
  const similar = await query<{
    idea_id: string;
    slug: string;
    title: string;
    shared_count: number;
  }>(
    `SELECT
      i.id as idea_id,
      i.slug,
      i.title,
      COUNT(DISTINCT t.name) as shared_count
     FROM ideas i
     JOIN idea_tags it ON it.idea_id = i.id
     JOIN tags t ON t.id = it.tag_id
     WHERE i.id != ? AND t.name IN (${myTags.map(() => "?").join(",")})
     GROUP BY i.id
     ORDER BY shared_count DESC
     LIMIT ?`,
    [ideaId, ...myTags, limit],
  );

  // Get shared tags for each
  const results = await Promise.all(
    similar.map(async (s) => {
      const theirTags = await getIdeaTags(s.idea_id);
      const sharedTags = myTags.filter((t) => theirTags.includes(t));
      return {
        slug: s.slug,
        title: s.title,
        sharedTags,
        score: sharedTags.length / myTags.length,
      };
    }),
  );

  return results;
}

/**
 * Get all tags with usage counts
 */
export async function getAllTags(): Promise<
  Array<{
    name: string;
    count: number;
  }>
> {
  const tags = await query<{
    name: string;
    count: number;
  }>(
    `SELECT t.name, COUNT(it.idea_id) as count
     FROM tags t
     LEFT JOIN idea_tags it ON t.id = it.tag_id
     GROUP BY t.id
     ORDER BY count DESC`,
  );
  return tags;
}
