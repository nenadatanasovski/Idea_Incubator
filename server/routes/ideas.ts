/**
 * Ideas Routes
 * CRUD routes for ideas
 */
import { Router } from "express";
import { asyncHandler, respond, IdeaRow } from "./shared.js";
import { query, getOne } from "../../database/db.js";

const router = Router();

// GET /api/ideas - List all ideas with optional filters
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      type,
      stage,
      tag,
      search,
      sortBy = "updated_at",
      sortOrder = "desc",
    } = req.query;

    let sql = `
    SELECT
      i.*,
      s.avg_score as avg_final_score,
      s.avg_confidence,
      s.latest_run_id,
      s.total_evaluation_count
    FROM ideas i
    LEFT JOIN idea_latest_scores s ON i.id = s.id
    WHERE 1=1
  `;
    const params: (string | number)[] = [];

    if (type) {
      sql += " AND i.idea_type = ?";
      params.push(type as string);
    }

    if (stage) {
      sql += " AND i.lifecycle_stage = ?";
      params.push(stage as string);
    }

    if (search) {
      sql += " AND (i.title LIKE ? OR i.summary LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // Sort
    const validSortFields = ["title", "created_at", "updated_at", "score"];
    const sortField = validSortFields.includes(sortBy as string)
      ? sortBy === "score"
        ? "avg_final_score"
        : `i.${sortBy}`
      : "i.updated_at";
    const order = sortOrder === "asc" ? "ASC" : "DESC";
    sql += ` ORDER BY ${sortField} ${order}`;

    const ideas = await query<IdeaRow & { avg_final_score: number | null }>(
      sql,
      params,
    );

    // Fetch tags for each idea
    const ideasWithTags = await Promise.all(
      ideas.map(async (idea) => {
        const tags = await query<{ name: string }>(
          `SELECT t.name FROM tags t
         JOIN idea_tags it ON t.id = it.tag_id
         WHERE it.idea_id = ?`,
          [idea.id],
        );
        return { ...idea, tags: tags.map((t) => t.name) };
      }),
    );

    // Filter by tag if specified
    const filtered = tag
      ? ideasWithTags.filter((i) => i.tags.includes(tag as string))
      : ideasWithTags;

    respond(res, filtered);
  }),
);

// GET /api/ideas/:slug - Get single idea
router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const idea = await getOne<{
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      idea_type: string;
      lifecycle_stage: string;
      incubation_phase: string | null;
      content: string | null;
      content_hash: string | null;
      folder_path: string;
      created_at: string;
      updated_at: string;
      avg_final_score: number | null;
      avg_confidence: number | null;
      latest_run_id: string | null;
      total_evaluation_count: number;
    }>(
      `SELECT
      i.*,
      s.avg_score as avg_final_score,
      s.avg_confidence,
      s.latest_run_id,
      s.total_evaluation_count
    FROM ideas i
    LEFT JOIN idea_latest_scores s ON i.id = s.id
    WHERE i.slug = ?`,
      [slug],
    );

    if (!idea) {
      res.status(404).json({ success: false, error: "Idea not found" });
      return;
    }

    // Fetch tags
    const tags = await query<{ name: string }>(
      `SELECT t.name FROM tags t
     JOIN idea_tags it ON t.id = it.tag_id
     WHERE it.idea_id = ?`,
      [idea.id],
    );

    // Read content from README.md file
    let content: string | null = null;
    if (idea.folder_path) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const readmePath = path.join(
          process.cwd(),
          idea.folder_path,
          "README.md",
        );
        const fileContent = await fs.readFile(readmePath, "utf-8");

        // Extract body content (everything after the frontmatter closing ---)
        const frontmatterEnd = fileContent.indexOf("---", 3);
        if (frontmatterEnd !== -1) {
          // Find the title heading and get everything after it
          const afterFrontmatter = fileContent.slice(frontmatterEnd + 3).trim();
          const titleMatch = afterFrontmatter.match(/^#\s+.+\n+/);
          if (titleMatch) {
            content = afterFrontmatter.slice(titleMatch[0].length).trim();
          } else {
            content = afterFrontmatter;
          }
        }
      } catch (err) {
        console.error(`Failed to read README.md for ${slug}:`, err);
      }
    }

    // Map DB phase to UI phase - 'differentiation' -> 'position'
    const uiPhase =
      idea.incubation_phase === "differentiation"
        ? "position"
        : idea.incubation_phase;

    respond(res, {
      ...idea,
      incubation_phase: uiPhase,
      content,
      tags: tags.map((t) => t.name),
    });
  }),
);

// POST /api/ideas - Create a new idea
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, summary, idea_type, lifecycle_stage, content, tags } =
      req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ success: false, error: "Title is required" });
      return;
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if slug already exists
    const existing = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [slug],
    );
    if (existing) {
      res.status(409).json({
        success: false,
        error: "An idea with this title already exists",
      });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dateOnly = now.split("T")[0];
    const folderPath = `ideas/${slug}`;
    const tagsArray = tags && Array.isArray(tags) ? tags : [];

    // Create idea folder and README.md
    const fs = await import("fs/promises");
    const path = await import("path");
    const cryptoModule = await import("crypto");

    const ideaDir = path.join(process.cwd(), folderPath);
    await fs.mkdir(ideaDir, { recursive: true });
    await fs.mkdir(path.join(ideaDir, "assets"), { recursive: true });
    await fs.mkdir(path.join(ideaDir, "notes"), { recursive: true });
    await fs.mkdir(path.join(ideaDir, "research"), { recursive: true });

    // Create README.md with frontmatter
    const readmeContent = `---
id: ${id}
title: ${title.trim()}
type: ${idea_type || "business"}
stage: ${lifecycle_stage || "SPARK"}
created: ${dateOnly}
updated: ${dateOnly}
tags: [${tagsArray.map((t: string) => `"${t}"`).join(", ")}]
related: []
summary: "${(summary || "").replace(/"/g, '\\"')}"
---

# ${title.trim()}

${
  content ||
  `## Overview

*Brief description of the idea.*

## Problem Statement

*What problem does this solve? Who experiences this problem?*

## Proposed Solution

*How does this idea solve the problem?*
`
}
`;

    await fs.writeFile(path.join(ideaDir, "README.md"), readmeContent, "utf-8");

    // Compute content hash
    const contentHash = cryptoModule
      .createHash("md5")
      .update(readmeContent)
      .digest("hex");

    await query(
      `INSERT INTO ideas (id, slug, title, summary, idea_type, lifecycle_stage, content_hash, folder_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        slug,
        title.trim(),
        summary?.trim() || null,
        idea_type || "business",
        lifecycle_stage || "SPARK",
        contentHash,
        folderPath,
        now,
        now,
      ],
    );

    // Add tags if provided
    if (tagsArray.length > 0) {
      for (const tagName of tagsArray) {
        let tag = await getOne<{ id: number }>(
          "SELECT id FROM tags WHERE name = ?",
          [tagName],
        );
        if (!tag) {
          await query("INSERT INTO tags (name) VALUES (?)", [tagName]);
          tag = await getOne<{ id: number }>(
            "SELECT id FROM tags WHERE name = ?",
            [tagName],
          );
        }
        if (tag) {
          await query(
            "INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)",
            [id, tag.id],
          );
        }
      }
    }

    respond(res, { id, slug });
  }),
);

// PUT /api/ideas/:slug - Update an idea
router.put(
  "/:slug",
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { title, summary, idea_type, lifecycle_stage, content, tags } =
      req.body;

    const idea = await getOne<{ id: string; folder_path: string }>(
      "SELECT id, folder_path FROM ideas WHERE slug = ?",
      [slug],
    );
    if (!idea) {
      res.status(404).json({ success: false, error: "Idea not found" });
      return;
    }

    const now = new Date().toISOString();
    const dateOnly = now.split("T")[0];
    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title.trim());
    }
    if (summary !== undefined) {
      updates.push("summary = ?");
      params.push(summary?.trim() || null);
    }
    if (idea_type !== undefined) {
      updates.push("idea_type = ?");
      params.push(idea_type);
    }
    if (lifecycle_stage !== undefined) {
      updates.push("lifecycle_stage = ?");
      params.push(lifecycle_stage);
    }

    // Update README.md if content or metadata changed
    if (idea.folder_path) {
      const fs = await import("fs/promises");
      const path = await import("path");
      const cryptoModule = await import("crypto");

      // Get current values
      const currentIdea = await getOne<{
        title: string;
        summary: string | null;
        idea_type: string;
        lifecycle_stage: string;
      }>(
        "SELECT title, summary, idea_type, lifecycle_stage FROM ideas WHERE id = ?",
        [idea.id],
      );

      const finalTitle =
        title !== undefined ? title.trim() : currentIdea?.title || "";
      const finalSummary =
        summary !== undefined
          ? summary?.trim() || ""
          : currentIdea?.summary || "";
      const finalType =
        idea_type !== undefined
          ? idea_type
          : currentIdea?.idea_type || "business";
      const finalStage =
        lifecycle_stage !== undefined
          ? lifecycle_stage
          : currentIdea?.lifecycle_stage || "SPARK";
      const tagsArray = tags !== undefined ? tags : [];

      // Read existing content from file if not provided
      let finalContent = content;
      if (finalContent === undefined) {
        try {
          const readmePath = path.join(
            process.cwd(),
            idea.folder_path,
            "README.md",
          );
          const existingFile = await fs.readFile(readmePath, "utf-8");
          // Extract body content (everything after frontmatter and title)
          const frontmatterEnd = existingFile.indexOf("---", 3);
          if (frontmatterEnd !== -1) {
            const afterFrontmatter = existingFile
              .slice(frontmatterEnd + 3)
              .trim();
            const titleMatch = afterFrontmatter.match(/^#\s+.+\n+/);
            if (titleMatch) {
              finalContent = afterFrontmatter
                .slice(titleMatch[0].length)
                .trim();
            } else {
              finalContent = afterFrontmatter;
            }
          }
        } catch (err) {
          console.error("Failed to read existing content:", err);
        }
      }

      // Fall back to template only if we couldn't get existing content
      if (!finalContent) {
        finalContent = `## Overview

*Brief description of the idea.*

## Problem Statement

*What problem does this solve? Who experiences this problem?*

## Proposed Solution

*How does this idea solve the problem?*`;
      }

      const readmeContent = `---
id: ${idea.id}
title: ${finalTitle}
type: ${finalType}
stage: ${finalStage}
created: ${dateOnly}
updated: ${dateOnly}
tags: [${tagsArray.map((t: string) => `"${t}"`).join(", ")}]
related: []
summary: "${finalSummary.replace(/"/g, '\\"')}"
---

# ${finalTitle}

${finalContent}
`;

      const readmePath = path.join(
        process.cwd(),
        idea.folder_path,
        "README.md",
      );
      await fs.writeFile(readmePath, readmeContent, "utf-8");

      // Update content hash
      const contentHash = cryptoModule
        .createHash("md5")
        .update(readmeContent)
        .digest("hex");
      updates.push("content_hash = ?");
      params.push(contentHash);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(now);
      params.push(idea.id);
      await query(
        `UPDATE ideas SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
    }

    // Update tags if provided
    if (tags !== undefined && Array.isArray(tags)) {
      // Remove existing tags
      await query("DELETE FROM idea_tags WHERE idea_id = ?", [idea.id]);

      // Add new tags
      for (const tagName of tags) {
        let tag = await getOne<{ id: number }>(
          "SELECT id FROM tags WHERE name = ?",
          [tagName],
        );
        if (!tag) {
          await query("INSERT INTO tags (name) VALUES (?)", [tagName]);
          tag = await getOne<{ id: number }>(
            "SELECT id FROM tags WHERE name = ?",
            [tagName],
          );
        }
        if (tag) {
          await query(
            "INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)",
            [idea.id, tag.id],
          );
        }
      }
    }

    respond(res, { success: true });
  }),
);

// DELETE /api/ideas/:slug - Delete an idea
router.delete(
  "/:slug",
  asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [slug],
    );
    if (!idea) {
      res.status(404).json({ success: false, error: "Idea not found" });
      return;
    }

    // Delete related data (cascading should handle this, but being explicit)
    await query("DELETE FROM idea_tags WHERE idea_id = ?", [idea.id]);
    await query("DELETE FROM evaluations WHERE idea_id = ?", [idea.id]);
    await query("DELETE FROM debate_rounds WHERE idea_id = ?", [idea.id]);
    await query("DELETE FROM redteam_log WHERE idea_id = ?", [idea.id]);
    await query("DELETE FROM final_syntheses WHERE idea_id = ?", [idea.id]);
    await query("DELETE FROM development_log WHERE idea_id = ?", [idea.id]);
    await query("DELETE FROM cost_log WHERE idea_id = ?", [idea.id]);
    await query("DELETE FROM ideas WHERE id = ?", [idea.id]);

    respond(res, { success: true });
  }),
);

// PATCH /api/ideas/:slug/stage - Update lifecycle stage only
router.patch(
  "/:slug/stage",
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { lifecycle_stage } = req.body;

    if (!lifecycle_stage) {
      res
        .status(400)
        .json({ success: false, error: "lifecycle_stage is required" });
      return;
    }

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [slug],
    );
    if (!idea) {
      res.status(404).json({ success: false, error: "Idea not found" });
      return;
    }

    await query(
      "UPDATE ideas SET lifecycle_stage = ?, updated_at = ? WHERE id = ?",
      [lifecycle_stage, new Date().toISOString(), idea.id],
    );

    respond(res, { success: true });
  }),
);

export default router;
