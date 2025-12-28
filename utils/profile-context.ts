/**
 * Profile Context Formatter
 *
 * Format profile context with category-relevant excerpts.
 * Replaces the empty string for non-fit categories to provide
 * focused, token-efficient context to each evaluator.
 */
import { ProfileContext } from './schemas.js';
import { type Category } from '../agents/config.js';

/**
 * Extract a specific field from a context string
 */
function extractField(context: string, fieldName: string): string | null {
  const pattern = new RegExp(`${fieldName}[:\\s]+(.+?)(?:\\n|$)`, 'i');
  const match = context.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Format profile context for a specific evaluator category.
 * Returns category-relevant excerpts instead of full profile dump.
 *
 * @param profile - The user's profile context (null if no profile linked)
 * @param category - The evaluation category (problem, solution, feasibility, fit, market, risk)
 * @returns Formatted profile section for the evaluator prompt
 */
export function formatProfileForCategory(
  profile: ProfileContext | null,
  category: Category
): string {
  if (!profile) {
    return `## Creator Context
No user profile available. Where creator capabilities affect your assessment, note this uncertainty and apply lower confidence (0.4-0.5).`;
  }

  switch (category) {
    case 'feasibility':
      return `## Creator Capabilities (for Feasibility Assessment)

**Technical Skills:**
${profile.skillsContext}

**Time Availability:**
${extractField(profile.lifeStageContext, 'Hours Available') || extractField(profile.lifeStageContext, 'Weekly Hours') || 'Not specified'}

**Known Skill Gaps:**
${extractField(profile.skillsContext, 'Gaps') || extractField(profile.skillsContext, 'Known Gaps') || 'Not specified'}

**IMPORTANT**: Use this profile to assess whether the creator can realistically build this solution. Consider their skills, time, and gaps when evaluating F1-F5 criteria.`;

    case 'market':
      return `## Creator Network (for Market Assessment)

**Industry Connections:**
${profile.networkContext}

**Community Access:**
${extractField(profile.networkContext, 'Community') || extractField(profile.networkContext, 'Communities') || 'Not specified'}

**Professional Network:**
${extractField(profile.networkContext, 'Network') || extractField(profile.networkContext, 'Professional Network') || 'Not specified'}

**IMPORTANT**: Use this profile to assess go-to-market feasibility. Consider whether the creator has connections that could help overcome entry barriers (M4) or provide distribution advantages.`;

    case 'risk':
      return `## Creator Risk Profile (for Risk Assessment)

**Financial Runway:**
${extractField(profile.lifeStageContext, 'Runway') || extractField(profile.lifeStageContext, 'Financial Runway') || 'Not specified'}

**Risk Tolerance:**
${extractField(profile.lifeStageContext, 'Tolerance') || extractField(profile.lifeStageContext, 'Risk Tolerance') || 'Not specified'}

**Employment Status:**
${extractField(profile.lifeStageContext, 'Status') || extractField(profile.lifeStageContext, 'Employment') || 'Not specified'}

**Professional Experience:**
${extractField(profile.skillsContext, 'Experience') || extractField(profile.skillsContext, 'Professional Experience') || 'Not specified'}

**IMPORTANT**: Use this profile to assess execution risk (R1), financial risk (R4), and overall risk exposure. A creator with 6 months runway has different risk capacity than one with 24 months.`;

    case 'fit':
      // Full profile for Fit category (existing behavior)
      return formatFullProfileContext(profile);

    case 'problem':
    case 'solution':
      // These categories don't need profile context
      return '';

    default:
      return '';
  }
}

/**
 * Format full profile context for the Fit evaluator.
 * This is used for FT1-FT5 criteria which need complete profile data.
 */
function formatFullProfileContext(profile: ProfileContext): string {
  return `## Creator Profile (REQUIRED for Personal Fit Evaluation)

### Personal Goals (FT1 - Personal Fit)
${profile.goalsContext}

### Passion & Motivation (FT2 - Passion Alignment)
${profile.passionContext}

### Skills & Experience (FT3 - Skill Match)
${profile.skillsContext}

### Network & Connections (FT4 - Network Leverage)
${profile.networkContext}

### Life Stage & Capacity (FT5 - Life Stage Fit)
${profile.lifeStageContext}

**CRITICAL**: You MUST use this detailed profile information to provide accurate, high-confidence assessments for all Personal Fit criteria (FT1-FT5). Reference specific profile details in your reasoning. With this profile data, you should be able to give confident scores (0.7-0.9 confidence) rather than neutral assessments.`;
}
