/**
 * Profiles Routes
 * Routes for user profile management
 */
import { Router } from "express";
import { asyncHandler, respond } from "./shared.js";
import { query, getOne, saveDb } from "../../database/db.js";

const router = Router();

// GET /api/profiles - List all user profiles
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const profiles = await query<{
      id: string;
      name: string;
      slug: string;
      primary_goals: string;
      success_definition: string | null;
      interests: string | null;
      motivations: string | null;
      technical_skills: string | null;
      professional_experience: string | null;
      domain_expertise: string | null;
      industry_connections: string | null;
      professional_network: string | null;
      employment_status: string | null;
      weekly_hours_available: number | null;
      financial_runway_months: number | null;
      risk_tolerance: string | null;
      other_commitments: string | null;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM user_profiles ORDER BY updated_at DESC");

    respond(res, profiles);
  }),
);

// GET /api/profiles/:id - Get single profile
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const profile = await getOne<{
      id: string;
      name: string;
      slug: string;
      [key: string]: unknown;
    }>("SELECT * FROM user_profiles WHERE id = ?", [id]);

    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    respond(res, profile);
  }),
);

// GET /api/profiles/:id/ideas - Get ideas linked to a profile
router.get(
  "/:id/ideas",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const ideas = await query<{ id: string; title: string; slug: string }>(
      `SELECT i.id, i.title, i.slug
     FROM ideas i
     JOIN idea_profiles ip ON i.id = ip.idea_id
     WHERE ip.profile_id = ?
     ORDER BY i.title`,
      [id],
    );

    respond(res, ideas);
  }),
);

// POST /api/profiles - Create new profile
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      name,
      // Geographic
      country,
      city,
      timezone,
      // Financial
      currency,
      current_monthly_income,
      target_monthly_income,
      monthly_expenses,
      available_capital,
      total_savings,
      // Demographics
      age_range,
      dependents,
      education_level,
      education_field,
      // FT1-FT5 fields
      primary_goals,
      success_definition,
      interests,
      motivations,
      technical_skills,
      professional_experience,
      domain_expertise,
      industry_connections,
      professional_network,
      // Communication & Reach
      languages,
      social_media_following,
      existing_audience,
      // Resources
      has_investor_access,
      has_existing_customers,
      resource_notes,
      // Life stage
      employment_status,
      weekly_hours_available,
      financial_runway_months,
      risk_tolerance,
      other_commitments,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: "Name is required" });
      return;
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if slug already exists
    const existing = await getOne<{ id: string }>(
      "SELECT id FROM user_profiles WHERE slug = ?",
      [slug],
    );
    if (existing) {
      res.status(409).json({
        success: false,
        error: "A profile with this name already exists",
      });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO user_profiles (
      id, name, slug,
      country, city, timezone,
      currency, current_monthly_income, target_monthly_income, monthly_expenses, available_capital, total_savings,
      age_range, dependents, education_level, education_field,
      primary_goals, success_definition, interests, motivations,
      technical_skills, professional_experience, domain_expertise, industry_connections,
      professional_network, languages, social_media_following, existing_audience,
      has_investor_access, has_existing_customers, resource_notes,
      employment_status, weekly_hours_available, financial_runway_months,
      risk_tolerance, other_commitments, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name.trim(),
        slug,
        country || null,
        city || null,
        timezone || null,
        currency || "USD",
        current_monthly_income ?? null,
        target_monthly_income ?? null,
        monthly_expenses ?? null,
        available_capital ?? null,
        total_savings ?? null,
        age_range || null,
        dependents ?? 0,
        education_level || null,
        education_field || null,
        primary_goals || "[]",
        success_definition || null,
        interests || "[]",
        motivations || null,
        technical_skills || "[]",
        professional_experience || null,
        domain_expertise || null,
        industry_connections || "[]",
        professional_network || null,
        languages || "[]",
        social_media_following ?? null,
        existing_audience || null,
        has_investor_access ? 1 : 0,
        has_existing_customers ? 1 : 0,
        resource_notes || null,
        employment_status || null,
        weekly_hours_available ?? null,
        financial_runway_months ?? null,
        risk_tolerance || null,
        other_commitments || null,
        now,
        now,
      ],
    );

    respond(res, { id, slug });
  }),
);

// PUT /api/profiles/:id - Update profile
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      // Geographic
      country,
      city,
      timezone,
      // Financial
      currency,
      current_monthly_income,
      target_monthly_income,
      monthly_expenses,
      available_capital,
      total_savings,
      // Demographics
      age_range,
      dependents,
      education_level,
      education_field,
      // FT1-FT5 fields
      primary_goals,
      success_definition,
      interests,
      motivations,
      technical_skills,
      professional_experience,
      domain_expertise,
      industry_connections,
      professional_network,
      // Communication & Reach
      languages,
      social_media_following,
      existing_audience,
      // Resources
      has_investor_access,
      has_existing_customers,
      resource_notes,
      // Life stage
      employment_status,
      weekly_hours_available,
      financial_runway_months,
      risk_tolerance,
      other_commitments,
    } = req.body;

    const existing = await getOne<{ id: string }>(
      "SELECT id FROM user_profiles WHERE id = ?",
      [id],
    );
    if (!existing) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    const now = new Date().toISOString();

    await query(
      `UPDATE user_profiles SET
      name = ?, country = ?, city = ?, timezone = ?,
      currency = ?, current_monthly_income = ?, target_monthly_income = ?, monthly_expenses = ?, available_capital = ?, total_savings = ?,
      age_range = ?, dependents = ?, education_level = ?, education_field = ?,
      primary_goals = ?, success_definition = ?, interests = ?, motivations = ?,
      technical_skills = ?, professional_experience = ?, domain_expertise = ?, industry_connections = ?,
      professional_network = ?, languages = ?, social_media_following = ?, existing_audience = ?,
      has_investor_access = ?, has_existing_customers = ?, resource_notes = ?,
      employment_status = ?, weekly_hours_available = ?, financial_runway_months = ?,
      risk_tolerance = ?, other_commitments = ?, updated_at = ?
     WHERE id = ?`,
      [
        name?.trim(),
        country || null,
        city || null,
        timezone || null,
        currency || "USD",
        current_monthly_income ?? null,
        target_monthly_income ?? null,
        monthly_expenses ?? null,
        available_capital ?? null,
        total_savings ?? null,
        age_range || null,
        dependents ?? 0,
        education_level || null,
        education_field || null,
        primary_goals || "[]",
        success_definition || null,
        interests || "[]",
        motivations || null,
        technical_skills || "[]",
        professional_experience || null,
        domain_expertise || null,
        industry_connections || "[]",
        professional_network || null,
        languages || "[]",
        social_media_following ?? null,
        existing_audience || null,
        has_investor_access ? 1 : 0,
        has_existing_customers ? 1 : 0,
        resource_notes || null,
        employment_status || null,
        weekly_hours_available ?? null,
        financial_runway_months ?? null,
        risk_tolerance || null,
        other_commitments || null,
        now,
        id,
      ],
    );

    respond(res, { success: true });
  }),
);

// DELETE /api/profiles/:id - Delete profile
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await getOne<{ id: string }>(
      "SELECT id FROM user_profiles WHERE id = ?",
      [id],
    );
    if (!existing) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    // Delete linked ideas first
    await query("DELETE FROM idea_profiles WHERE profile_id = ?", [id]);
    // Delete profile
    await query("DELETE FROM user_profiles WHERE id = ?", [id]);

    respond(res, { success: true });
  }),
);

// POST /api/profiles/:profileId/link/:ideaSlug - Link profile to idea
router.post(
  "/:profileId/link/:ideaSlug",
  asyncHandler(async (req, res) => {
    const { profileId, ideaSlug } = req.params;

    const profile = await getOne<{ id: string }>(
      "SELECT id FROM user_profiles WHERE id = ?",
      [profileId],
    );
    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [ideaSlug],
    );
    if (!idea) {
      res.status(404).json({ success: false, error: "Idea not found" });
      return;
    }

    // Check if already linked
    const existingLink = await getOne<{ idea_id: string }>(
      "SELECT idea_id FROM idea_profiles WHERE idea_id = ? AND profile_id = ?",
      [idea.id, profileId],
    );

    if (!existingLink) {
      await query(
        "INSERT INTO idea_profiles (idea_id, profile_id, linked_at) VALUES (?, ?, ?)",
        [idea.id, profileId, new Date().toISOString()],
      );
      await saveDb(); // Persist to disk
    }

    respond(res, { success: true });
  }),
);

// DELETE /api/profiles/:profileId/link/:ideaSlug - Unlink profile from idea
router.delete(
  "/:profileId/link/:ideaSlug",
  asyncHandler(async (req, res) => {
    const { profileId, ideaSlug } = req.params;

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [ideaSlug],
    );
    if (!idea) {
      res.status(404).json({ success: false, error: "Idea not found" });
      return;
    }

    await query(
      "DELETE FROM idea_profiles WHERE idea_id = ? AND profile_id = ?",
      [idea.id, profileId],
    );
    await saveDb(); // Persist to disk

    respond(res, { success: true });
  }),
);

export default router;
