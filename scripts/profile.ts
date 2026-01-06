#!/usr/bin/env tsx
/**
 * User Profile Management Module
 *
 * Manages user profiles for Personal Fit (FT1-FT5) evaluation context.
 * Profiles can be reused across ideas and customized per-idea.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/index.js';
import { query, insert, update, getOne, saveDb, run } from '../database/db.js';
import { titleToSlug } from '../utils/parser.js';
import { logSuccess, logError } from '../utils/logger.js';
import {
  UserProfile,
  ProfileInput,
  ProfileContext,
  IdeaProfileLink,
  PrimaryGoal,
  EmploymentStatus,
  RiskTolerance,
  IndustryConnection
} from '../utils/schemas.js';

// ==========================================
// DATABASE OPERATIONS
// ==========================================

interface ProfileRow extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  primary_goals: string;
  success_definition: string | null;
  interests: string | null;
  motivations: string | null;
  domain_connection: string | null;
  technical_skills: string | null;
  professional_experience: string | null;
  domain_expertise: string | null;
  known_gaps: string | null;
  industry_connections: string | null;
  professional_network: string | null;
  community_access: string | null;
  partnership_potential: string | null;
  employment_status: string | null;
  weekly_hours_available: number | null;
  financial_runway_months: number | null;
  risk_tolerance: string | null;
  other_commitments: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Safely parse a JSON string or handle comma-separated plain strings
 * Returns an empty array if the value is null, undefined, or empty
 */
function safeParseArray(value: string | null | undefined): string[] {
  if (!value || value.trim() === '') return [];

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    // If parsed to something else, treat original as plain string
  } catch {
    // Not valid JSON, treat as comma-separated string
  }

  // Fall back to splitting by comma
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Safely parse a JSON object array (like industryConnections)
 */
function safeParseObjectArray<T>(value: string | null | undefined): T[] {
  if (!value || value.trim() === '') return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not valid JSON
  }

  return [];
}

/**
 * Convert database row to UserProfile object
 */
function rowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    primaryGoals: safeParseArray(row.primary_goals) as PrimaryGoal[],
    successDefinition: row.success_definition ?? undefined,
    interests: safeParseArray(row.interests),
    motivations: row.motivations ?? undefined,
    domainConnection: row.domain_connection ?? undefined,
    technicalSkills: safeParseArray(row.technical_skills),
    professionalExperience: row.professional_experience ?? undefined,
    domainExpertise: safeParseArray(row.domain_expertise),
    knownGaps: row.known_gaps ?? undefined,
    industryConnections: safeParseObjectArray<IndustryConnection>(row.industry_connections),
    professionalNetwork: row.professional_network ?? undefined,
    communityAccess: safeParseArray(row.community_access),
    partnershipPotential: row.partnership_potential ?? undefined,
    employmentStatus: row.employment_status as EmploymentStatus ?? undefined,
    weeklyHoursAvailable: row.weekly_hours_available ?? undefined,
    financialRunwayMonths: row.financial_runway_months ?? undefined,
    riskTolerance: row.risk_tolerance as RiskTolerance ?? undefined,
    otherCommitments: row.other_commitments ?? undefined,
    // Geographic location
    country: (row as Record<string, unknown>).country as string | undefined,
    city: (row as Record<string, unknown>).city as string | undefined,
    timezone: (row as Record<string, unknown>).timezone as string | undefined,
    currency: (row as Record<string, unknown>).currency as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Create a new user profile
 */
export async function createProfile(input: ProfileInput): Promise<UserProfile> {
  const id = uuidv4();
  const slug = titleToSlug(input.name);
  const now = new Date().toISOString();

  // Check if slug already exists
  const existing = await getOne<ProfileRow>(
    'SELECT id FROM user_profiles WHERE slug = ?',
    [slug]
  );

  if (existing) {
    throw new Error(`Profile with slug "${slug}" already exists`);
  }

  await insert('user_profiles', {
    id,
    name: input.name,
    slug,
    primary_goals: JSON.stringify(input.primaryGoals),
    success_definition: input.successDefinition ?? null,
    interests: input.interests ? JSON.stringify(input.interests) : null,
    motivations: input.motivations ?? null,
    domain_connection: input.domainConnection ?? null,
    technical_skills: input.technicalSkills ? JSON.stringify(input.technicalSkills) : null,
    professional_experience: input.professionalExperience ?? null,
    domain_expertise: input.domainExpertise ? JSON.stringify(input.domainExpertise) : null,
    known_gaps: input.knownGaps ?? null,
    industry_connections: input.industryConnections ? JSON.stringify(input.industryConnections) : null,
    professional_network: input.professionalNetwork ?? null,
    community_access: input.communityAccess ? JSON.stringify(input.communityAccess) : null,
    partnership_potential: input.partnershipPotential ?? null,
    employment_status: input.employmentStatus ?? null,
    weekly_hours_available: input.weeklyHoursAvailable ?? null,
    financial_runway_months: input.financialRunwayMonths ?? null,
    risk_tolerance: input.riskTolerance ?? null,
    other_commitments: input.otherCommitments ?? null,
    created_at: now,
    updated_at: now
  });

  await saveDb();

  return {
    id,
    slug,
    ...input,
    interests: input.interests ?? [],
    technicalSkills: input.technicalSkills ?? [],
    domainExpertise: input.domainExpertise ?? [],
    industryConnections: input.industryConnections ?? [],
    communityAccess: input.communityAccess ?? [],
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Get profile by slug
 */
export async function getProfileBySlug(slug: string): Promise<UserProfile | null> {
  const row = await getOne<ProfileRow>(
    'SELECT * FROM user_profiles WHERE slug = ?',
    [slug]
  );

  return row ? rowToProfile(row) : null;
}

/**
 * Get profile by ID
 */
export async function getProfileById(id: string): Promise<UserProfile | null> {
  const row = await getOne<ProfileRow>(
    'SELECT * FROM user_profiles WHERE id = ?',
    [id]
  );

  return row ? rowToProfile(row) : null;
}

/**
 * List all profiles
 */
export async function listProfiles(): Promise<UserProfile[]> {
  const rows = await query<ProfileRow>(
    'SELECT * FROM user_profiles ORDER BY name'
  );

  return rows.map(rowToProfile);
}

/**
 * Update a profile
 */
export async function updateProfile(
  slug: string,
  updates: Partial<ProfileInput>
): Promise<UserProfile | null> {
  const existing = await getProfileBySlug(slug);
  if (!existing) return null;

  const now = new Date().toISOString();
  const data: Record<string, unknown> = { updated_at: now };

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.primaryGoals !== undefined) data.primary_goals = JSON.stringify(updates.primaryGoals);
  if (updates.successDefinition !== undefined) data.success_definition = updates.successDefinition;
  if (updates.interests !== undefined) data.interests = JSON.stringify(updates.interests);
  if (updates.motivations !== undefined) data.motivations = updates.motivations;
  if (updates.domainConnection !== undefined) data.domain_connection = updates.domainConnection;
  if (updates.technicalSkills !== undefined) data.technical_skills = JSON.stringify(updates.technicalSkills);
  if (updates.professionalExperience !== undefined) data.professional_experience = updates.professionalExperience;
  if (updates.domainExpertise !== undefined) data.domain_expertise = JSON.stringify(updates.domainExpertise);
  if (updates.knownGaps !== undefined) data.known_gaps = updates.knownGaps;
  if (updates.industryConnections !== undefined) data.industry_connections = JSON.stringify(updates.industryConnections);
  if (updates.professionalNetwork !== undefined) data.professional_network = updates.professionalNetwork;
  if (updates.communityAccess !== undefined) data.community_access = JSON.stringify(updates.communityAccess);
  if (updates.partnershipPotential !== undefined) data.partnership_potential = updates.partnershipPotential;
  if (updates.employmentStatus !== undefined) data.employment_status = updates.employmentStatus;
  if (updates.weeklyHoursAvailable !== undefined) data.weekly_hours_available = updates.weeklyHoursAvailable;
  if (updates.financialRunwayMonths !== undefined) data.financial_runway_months = updates.financialRunwayMonths;
  if (updates.riskTolerance !== undefined) data.risk_tolerance = updates.riskTolerance;
  if (updates.otherCommitments !== undefined) data.other_commitments = updates.otherCommitments;

  await update('user_profiles', data, 'slug = ?', [slug]);
  await saveDb();

  return getProfileBySlug(slug);
}

/**
 * Delete a profile
 */
export async function deleteProfile(slug: string): Promise<boolean> {
  const existing = await getProfileBySlug(slug);
  if (!existing) return false;

  await run('DELETE FROM user_profiles WHERE slug = ?', [slug]);
  await saveDb();
  return true;
}

// ==========================================
// IDEA-PROFILE LINKING
// ==========================================

/**
 * Link a profile to an idea
 */
export async function linkProfileToIdea(
  ideaId: string,
  profileId: string,
  overrides?: Partial<IdeaProfileLink>
): Promise<void> {
  const now = new Date().toISOString();

  // Check if link already exists
  const existing = await getOne<{ idea_id: string }>(
    'SELECT idea_id FROM idea_profiles WHERE idea_id = ? AND profile_id = ?',
    [ideaId, profileId]
  );

  if (existing) {
    // Update existing link
    await update('idea_profiles', {
      goals_override: overrides?.goalsOverride ? JSON.stringify(overrides.goalsOverride) : null,
      passion_notes: overrides?.passionNotes ?? null,
      relevant_skills: overrides?.relevantSkills ? JSON.stringify(overrides.relevantSkills) : null,
      relevant_network: overrides?.relevantNetwork ?? null,
      time_commitment: overrides?.timeCommitment ?? null,
      linked_at: now
    }, 'idea_id = ? AND profile_id = ?', [ideaId, profileId]);
  } else {
    // Create new link
    await insert('idea_profiles', {
      idea_id: ideaId,
      profile_id: profileId,
      goals_override: overrides?.goalsOverride ? JSON.stringify(overrides.goalsOverride) : null,
      passion_notes: overrides?.passionNotes ?? null,
      relevant_skills: overrides?.relevantSkills ? JSON.stringify(overrides.relevantSkills) : null,
      relevant_network: overrides?.relevantNetwork ?? null,
      time_commitment: overrides?.timeCommitment ?? null,
      linked_at: now
    });
  }

  await saveDb();
}

/**
 * Get the profile linked to an idea
 */
export async function getIdeaProfile(ideaId: string): Promise<{
  profile: UserProfile;
  overrides: Partial<IdeaProfileLink>;
} | null> {
  interface LinkRow {
    profile_id: string;
    goals_override: string | null;
    passion_notes: string | null;
    relevant_skills: string | null;
    relevant_network: string | null;
    time_commitment: string | null;
    [key: string]: unknown;
  }

  const link = await getOne<LinkRow>(
    'SELECT profile_id, goals_override, passion_notes, relevant_skills, relevant_network, time_commitment FROM idea_profiles WHERE idea_id = ?',
    [ideaId]
  );

  if (!link) return null;

  const profile = await getProfileById(link.profile_id);
  if (!profile) return null;

  return {
    profile,
    overrides: {
      goalsOverride: link.goals_override ? JSON.parse(link.goals_override) : undefined,
      passionNotes: link.passion_notes ?? undefined,
      relevantSkills: link.relevant_skills ? JSON.parse(link.relevant_skills) : undefined,
      relevantNetwork: link.relevant_network ?? undefined,
      timeCommitment: link.time_commitment ?? undefined
    }
  };
}

// ==========================================
// PROFILE CONTEXT GENERATION
// ==========================================

/**
 * Generate formatted profile context for evaluator prompts
 */
export function generateProfileContext(
  profile: UserProfile,
  overrides?: Partial<IdeaProfileLink>
): ProfileContext {
  // FT1: Goals Context
  const goals = overrides?.goalsOverride ?? profile.primaryGoals;
  const goalsContext = formatGoalsContext(goals, profile.successDefinition);

  // FT2: Passion Context
  const passionContext = formatPassionContext(
    profile.interests,
    profile.motivations,
    profile.domainConnection,
    overrides?.passionNotes
  );

  // FT3: Skills Context
  const skills = overrides?.relevantSkills ?? profile.technicalSkills;
  const skillsContext = formatSkillsContext(
    skills,
    profile.professionalExperience,
    profile.domainExpertise,
    profile.knownGaps
  );

  // FT4: Network Context
  const networkContext = formatNetworkContext(
    profile.industryConnections,
    profile.professionalNetwork,
    profile.communityAccess,
    profile.partnershipPotential,
    overrides?.relevantNetwork
  );

  // FT5: Life Stage Context
  const lifeStageContext = formatLifeStageContext(
    profile.employmentStatus,
    profile.weeklyHoursAvailable,
    profile.financialRunwayMonths,
    profile.riskTolerance,
    profile.otherCommitments,
    overrides?.timeCommitment
  );

  return {
    goalsContext,
    passionContext,
    skillsContext,
    networkContext,
    lifeStageContext,
    profile,
    ideaOverrides: overrides as IdeaProfileLink | undefined
  };
}

function formatGoalsContext(goals: PrimaryGoal[], successDef?: string): string {
  const goalLabels: Record<PrimaryGoal, string> = {
    income: 'Revenue/Income Generation',
    impact: 'Making a Positive Impact',
    learning: 'Learning & Skill Development',
    portfolio: 'Building Portfolio/Credentials',
    lifestyle: 'Work-Life Balance & Lifestyle',
    exit: 'Building to Sell/Exit',
    passion: 'Pursuing Personal Passion',
    legacy: 'Long-term Legacy Building'
  };

  let context = `**Primary Goals:** ${goals.map(g => goalLabels[g]).join(', ')}`;

  if (successDef) {
    context += `\n**Success Definition:** ${successDef}`;
  }

  return context;
}

function formatPassionContext(
  interests: string[],
  motivations?: string,
  domainConnection?: string,
  passionNotes?: string
): string {
  const parts: string[] = [];

  if (interests.length > 0) {
    parts.push(`**Areas of Interest:** ${interests.join(', ')}`);
  }

  if (motivations) {
    parts.push(`**Motivations:** ${motivations}`);
  }

  if (domainConnection) {
    parts.push(`**Domain Connection:** ${domainConnection}`);
  }

  if (passionNotes) {
    parts.push(`**Idea-Specific Passion:** ${passionNotes}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No passion/motivation information provided.';
}

function formatSkillsContext(
  skills: string[],
  experience?: string,
  expertise: string[] = [],
  gaps?: string
): string {
  const parts: string[] = [];

  if (skills.length > 0) {
    parts.push(`**Technical Skills:** ${skills.join(', ')}`);
  }

  if (experience) {
    parts.push(`**Professional Experience:** ${experience}`);
  }

  if (expertise.length > 0) {
    parts.push(`**Domain Expertise:** ${expertise.join(', ')}`);
  }

  if (gaps) {
    parts.push(`**Acknowledged Gaps:** ${gaps}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No skills information provided.';
}

function formatNetworkContext(
  industryConnections: IndustryConnection[],
  network?: string,
  communities: string[] = [],
  partnerships?: string,
  relevantNetwork?: string
): string {
  const parts: string[] = [];

  if (industryConnections.length > 0) {
    const formatted = industryConnections.map(ic =>
      `${ic.industry} (${ic.depth}${ic.description ? `: ${ic.description}` : ''})`
    ).join(', ');
    parts.push(`**Industry Connections:** ${formatted}`);
  }

  if (network) {
    parts.push(`**Professional Network:** ${network}`);
  }

  if (communities.length > 0) {
    parts.push(`**Community Access:** ${communities.join(', ')}`);
  }

  if (partnerships) {
    parts.push(`**Partnership Potential:** ${partnerships}`);
  }

  if (relevantNetwork) {
    parts.push(`**Idea-Specific Network:** ${relevantNetwork}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No network information provided.';
}

function formatLifeStageContext(
  status?: EmploymentStatus,
  hours?: number,
  runway?: number,
  risk?: RiskTolerance,
  commitments?: string,
  timeCommitment?: string
): string {
  const parts: string[] = [];

  if (status) {
    const statusLabels: Record<EmploymentStatus, string> = {
      employed: 'Currently Employed',
      'self-employed': 'Self-Employed',
      unemployed: 'Currently Unemployed',
      student: 'Student',
      retired: 'Retired'
    };
    parts.push(`**Employment Status:** ${statusLabels[status]}`);
  }

  if (hours !== undefined) {
    parts.push(`**Weekly Hours Available:** ${hours} hours/week`);
  }

  if (timeCommitment) {
    parts.push(`**Planned Time for This Idea:** ${timeCommitment}`);
  }

  if (runway !== undefined) {
    parts.push(`**Financial Runway:** ${runway} months`);
  }

  if (risk) {
    const riskLabels: Record<RiskTolerance, string> = {
      low: 'Low (prefer stability)',
      medium: 'Medium (balanced approach)',
      high: 'High (comfortable with uncertainty)',
      very_high: 'Very High (seeking high risk/reward)'
    };
    parts.push(`**Risk Tolerance:** ${riskLabels[risk]}`);
  }

  if (commitments) {
    parts.push(`**Other Commitments:** ${commitments}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No life stage information provided.';
}

/**
 * Get formatted profile context for an idea's evaluation
 */
export async function getEvaluationProfileContext(ideaId: string): Promise<ProfileContext | null> {
  const ideaProfile = await getIdeaProfile(ideaId);

  if (!ideaProfile) {
    return null;
  }

  return generateProfileContext(ideaProfile.profile, ideaProfile.overrides);
}

// ==========================================
// INTERACTIVE PROFILE CREATION
// ==========================================

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Create profile interactively via CLI
 */
export async function captureProfileInteractive(): Promise<UserProfile> {
  const rl = createReadlineInterface();

  try {
    console.log('\n=== User Profile Creation ===\n');
    console.log('This profile will be used to evaluate Personal Fit (FT1-FT5) criteria.\n');

    // Name
    const name = await prompt(rl, 'Profile name (e.g., your name): ');
    if (!name) throw new Error('Name is required');

    // FT1: Goals
    console.log('\n--- Personal Goals (FT1) ---');
    console.log('Select your primary goals (comma-separated numbers):');
    console.log('  1. income    - Revenue/salary generation');
    console.log('  2. impact    - Making a positive difference');
    console.log('  3. learning  - Skill development');
    console.log('  4. portfolio - Building credentials');
    console.log('  5. lifestyle - Work-life balance');
    console.log('  6. exit      - Building to sell');
    console.log('  7. passion   - Pursuing personal interest');
    console.log('  8. legacy    - Long-term contribution');

    const goalsInput = await prompt(rl, 'Goals (e.g., 1,2,7): ');
    const goalMap: Record<string, PrimaryGoal> = {
      '1': 'income', '2': 'impact', '3': 'learning', '4': 'portfolio',
      '5': 'lifestyle', '6': 'exit', '7': 'passion', '8': 'legacy'
    };
    const primaryGoals = goalsInput.split(',')
      .map(s => goalMap[s.trim()])
      .filter(Boolean) as PrimaryGoal[];

    if (primaryGoals.length === 0) {
      throw new Error('At least one goal is required');
    }

    const successDefinition = await prompt(rl, 'What does success look like for you? (optional): ');

    // FT2: Passion
    console.log('\n--- Passion & Motivation (FT2) ---');
    const interestsInput = await prompt(rl, 'Areas of interest (comma-separated, optional): ');
    const interests = interestsInput ? interestsInput.split(',').map(s => s.trim()).filter(Boolean) : [];

    const motivations = await prompt(rl, 'What motivates you? (optional): ');

    // FT3: Skills
    console.log('\n--- Skills & Experience (FT3) ---');
    const skillsInput = await prompt(rl, 'Technical skills (comma-separated, optional): ');
    const technicalSkills = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(Boolean) : [];

    const professionalExperience = await prompt(rl, 'Professional experience summary (optional): ');

    const expertiseInput = await prompt(rl, 'Domain expertise areas (comma-separated, optional): ');
    const domainExpertise = expertiseInput ? expertiseInput.split(',').map(s => s.trim()).filter(Boolean) : [];

    const knownGaps = await prompt(rl, 'What skill gaps do you have? (optional): ');

    // FT4: Network
    console.log('\n--- Network & Connections (FT4) ---');
    const professionalNetwork = await prompt(rl, 'Describe your professional network (optional): ');

    const communitiesInput = await prompt(rl, 'Communities you have access to (comma-separated, optional): ');
    const communityAccess = communitiesInput ? communitiesInput.split(',').map(s => s.trim()).filter(Boolean) : [];

    // FT5: Life Stage
    console.log('\n--- Life Stage & Capacity (FT5) ---');
    console.log('Employment status:');
    console.log('  1. employed  2. self-employed  3. unemployed  4. student  5. retired');
    const statusInput = await prompt(rl, 'Status (1-5): ');
    const statusMap: Record<string, EmploymentStatus> = {
      '1': 'employed', '2': 'self-employed', '3': 'unemployed', '4': 'student', '5': 'retired'
    };
    const employmentStatus = statusMap[statusInput.trim()];

    const hoursInput = await prompt(rl, 'Hours per week available for side projects (optional): ');
    const weeklyHoursAvailable = hoursInput ? parseInt(hoursInput, 10) : undefined;

    const runwayInput = await prompt(rl, 'Financial runway in months (optional): ');
    const financialRunwayMonths = runwayInput ? parseInt(runwayInput, 10) : undefined;

    console.log('Risk tolerance:');
    console.log('  1. low  2. medium  3. high  4. very_high');
    const riskInput = await prompt(rl, 'Risk tolerance (1-4): ');
    const riskMap: Record<string, RiskTolerance> = {
      '1': 'low', '2': 'medium', '3': 'high', '4': 'very_high'
    };
    const riskTolerance = riskMap[riskInput.trim()];

    const otherCommitments = await prompt(rl, 'Other commitments (family, projects, etc., optional): ');

    // Create the profile
    const profile = await createProfile({
      name,
      primaryGoals,
      successDefinition: successDefinition || undefined,
      interests,
      motivations: motivations || undefined,
      technicalSkills,
      professionalExperience: professionalExperience || undefined,
      domainExpertise,
      knownGaps: knownGaps || undefined,
      professionalNetwork: professionalNetwork || undefined,
      communityAccess,
      employmentStatus,
      weeklyHoursAvailable,
      financialRunwayMonths,
      riskTolerance,
      otherCommitments: otherCommitments || undefined
    });

    logSuccess(`Created profile: ${profile.name} (${profile.slug})`);
    console.log('\nUse this profile when capturing ideas for personalized evaluations.');

    return profile;
  } finally {
    rl.close();
  }
}

// ==========================================
// PROFILE FILE STORAGE (Markdown backup)
// ==========================================

/**
 * Save profile as markdown file for backup/portability
 */
export function saveProfileToFile(profile: UserProfile, dir?: string): string {
  const config = getConfig();
  // Use ideas directory parent as root since paths.root doesn't exist
  const rootDir = path.dirname(config.paths.ideas);
  const profilesDir = dir ?? path.join(rootDir, 'profiles');

  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }

  const filePath = path.join(profilesDir, `${profile.slug}.md`);
  const content = generateProfileMarkdown(profile);

  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function generateProfileMarkdown(profile: UserProfile): string {
  return `---
id: ${profile.id}
name: ${profile.name}
slug: ${profile.slug}
created: ${profile.createdAt}
updated: ${profile.updatedAt}
---

# ${profile.name}

## Personal Goals (FT1)

**Primary Goals:** ${profile.primaryGoals.join(', ')}

${profile.successDefinition ? `**Success Definition:** ${profile.successDefinition}` : ''}

## Passion & Motivation (FT2)

${profile.interests.length > 0 ? `**Areas of Interest:** ${profile.interests.join(', ')}` : ''}

${profile.motivations ? `**Motivations:** ${profile.motivations}` : ''}

${profile.domainConnection ? `**Domain Connection:** ${profile.domainConnection}` : ''}

## Skills & Experience (FT3)

${profile.technicalSkills.length > 0 ? `**Technical Skills:** ${profile.technicalSkills.join(', ')}` : ''}

${profile.professionalExperience ? `**Professional Experience:** ${profile.professionalExperience}` : ''}

${profile.domainExpertise.length > 0 ? `**Domain Expertise:** ${profile.domainExpertise.join(', ')}` : ''}

${profile.knownGaps ? `**Known Gaps:** ${profile.knownGaps}` : ''}

## Network & Connections (FT4)

${profile.industryConnections.length > 0 ? `**Industry Connections:**\n${profile.industryConnections.map(ic => `- ${ic.industry} (${ic.depth})`).join('\n')}` : ''}

${profile.professionalNetwork ? `**Professional Network:** ${profile.professionalNetwork}` : ''}

${profile.communityAccess.length > 0 ? `**Community Access:** ${profile.communityAccess.join(', ')}` : ''}

${profile.partnershipPotential ? `**Partnership Potential:** ${profile.partnershipPotential}` : ''}

## Life Stage & Capacity (FT5)

${profile.employmentStatus ? `**Employment Status:** ${profile.employmentStatus}` : ''}

${profile.weeklyHoursAvailable !== undefined ? `**Weekly Hours Available:** ${profile.weeklyHoursAvailable}` : ''}

${profile.financialRunwayMonths !== undefined ? `**Financial Runway:** ${profile.financialRunwayMonths} months` : ''}

${profile.riskTolerance ? `**Risk Tolerance:** ${profile.riskTolerance}` : ''}

${profile.otherCommitments ? `**Other Commitments:** ${profile.otherCommitments}` : ''}
`.replace(/\n{3,}/g, '\n\n');
}

// ==========================================
// CLI ENTRY POINT
// ==========================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'create':
        await captureProfileInteractive();
        break;

      case 'list': {
        const profiles = await listProfiles();
        if (profiles.length === 0) {
          console.log('No profiles found. Run "npm run profile create" to create one.');
        } else {
          console.log('\n=== User Profiles ===\n');
          for (const p of profiles) {
            console.log(`- ${p.name} (${p.slug}): ${p.primaryGoals.join(', ')}`);
          }
        }
        break;
      }

      case 'show': {
        const slug = args[1];
        if (!slug) {
          console.log('Usage: npm run profile show <slug>');
          process.exit(1);
        }
        const profile = await getProfileBySlug(slug);
        if (!profile) {
          console.log(`Profile not found: ${slug}`);
          process.exit(1);
        }
        console.log(generateProfileMarkdown(profile));
        break;
      }

      case 'export': {
        const slug = args[1];
        if (!slug) {
          console.log('Usage: npm run profile export <slug>');
          process.exit(1);
        }
        const profile = await getProfileBySlug(slug);
        if (!profile) {
          console.log(`Profile not found: ${slug}`);
          process.exit(1);
        }
        const filePath = saveProfileToFile(profile);
        logSuccess(`Exported profile to: ${filePath}`);
        break;
      }

      case 'link': {
        const [ideaSlug, profileSlug] = args.slice(1);
        if (!ideaSlug || !profileSlug) {
          console.log('Usage: npm run profile link <idea-slug> <profile-slug>');
          process.exit(1);
        }

        // Get idea ID
        const idea = await getOne<{ id: string }>(
          'SELECT id FROM ideas WHERE slug = ?',
          [ideaSlug]
        );
        if (!idea) {
          console.log(`Idea not found: ${ideaSlug}`);
          process.exit(1);
        }

        // Get profile
        const profile = await getProfileBySlug(profileSlug);
        if (!profile) {
          console.log(`Profile not found: ${profileSlug}`);
          process.exit(1);
        }

        await linkProfileToIdea(idea.id, profile.id);
        logSuccess(`Linked profile "${profileSlug}" to idea "${ideaSlug}"`);
        break;
      }

      default:
        console.log('Usage: npm run profile <command>');
        console.log('');
        console.log('Commands:');
        console.log('  create              Create a new user profile interactively');
        console.log('  list                List all profiles');
        console.log('  show <slug>         Show profile details');
        console.log('  export <slug>       Export profile to markdown file');
        console.log('  link <idea> <prof>  Link a profile to an idea');
    }
  } catch (error) {
    logError('Profile operation failed', error as Error);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('profile.ts') ||
  process.argv[1].endsWith('profile.js')
);

if (isMainModule) {
  main();
}
