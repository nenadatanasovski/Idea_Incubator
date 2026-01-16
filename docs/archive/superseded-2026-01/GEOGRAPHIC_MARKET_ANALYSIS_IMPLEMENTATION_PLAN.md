# Geographic Market Analysis Implementation Plan

> **Status:** Planning Phase
> **Created:** 2025-12-28
> **Author:** Claude Code Analysis

---

## Executive Summary

The current market analysis evaluates ideas against a single, global market perspective. However, market dynamics vary significantly by geography - a $320B global market may have vastly different characteristics in Australia (user's location) versus the US or Europe. This plan outlines how to incorporate the user's geographic location into market analysis, splitting the evaluation into **Local Market** and **Global Market** sections for more actionable insights.

---

## First Principles Analysis

### Core Problem

Market evaluation currently answers: "Is there a market for this idea?"

It should answer: "Is there a market for this idea **where I am**, and what are my options to expand?"

### Why Geography Matters for Each Market Criterion

| Criterion              | Why Geography Matters                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **M1: Market Size**    | TAM/SAM/SOM differ dramatically by region. Australia's pet market ≠ US pet market. |
| **M2: Market Growth**  | Growth rates vary - emerging markets may grow faster than mature ones.             |
| **M3: Competition**    | Local competitors differ from global players. Australian fintech landscape ≠ US.   |
| **M4: Entry Barriers** | Regulations, capital requirements, relationships are all geography-specific.       |
| **M5: Timing**         | Market readiness varies - a market may be mature in US but nascent in AU.          |

### The Network Effect Intersection

The user profile already captures **industry connections** and **professional network** (FT4), but without geographic context for these networks, we can't assess:

- Whether the user has **local** connections that help with **local** entry barriers
- Whether global expansion requires building entirely new networks
- The go-to-market advantage of starting locally vs. globally

---

## Current State Analysis

### What Geographic Data Exists

**User Profile (Database Schema):**

```sql
country TEXT,           -- e.g., "Australia"
city TEXT,              -- e.g., "Sydney"
timezone TEXT,          -- e.g., "UTC+10:00 (Sydney)"
currency TEXT,          -- e.g., "USD"
```

**Example Profile (ned):**

- Country: Australia
- City: Sydney
- Timezone: UTC+10:00 (Sydney)
- Currency: USD

### Current Market Analysis Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT EVALUATION FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. RESEARCH PHASE (research.ts)                                    │
│     └─ Web search: "pet market 2025" (NO GEO FILTER)                │
│     └─ Returns: Global market size, global competitors              │
│                                                                     │
│  2. MARKET EVALUATOR (specialized-evaluators.ts)                    │
│     └─ Receives: Global research + idea content                     │
│     └─ Evaluates: M1-M5 against GLOBAL market only                  │
│     └─ Profile context: Network info (NO location context)          │
│                                                                     │
│  3. OUTPUT (evaluation.md)                                          │
│     └─ Single market section                                        │
│     └─ Global TAM/SAM/SOM only                                      │
│     └─ No local market assessment                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Gap Identification

| Component                            | Current State             | Missing                             |
| ------------------------------------ | ------------------------- | ----------------------------------- |
| `UserProfileSchema`                  | Has country/city/timezone | ✅ Already exists                   |
| `ProfileContext`                     | Has networkContext        | ❌ No geographic context extraction |
| `formatProfileForCategory('market')` | Shows network             | ❌ Doesn't include location         |
| `research.ts`                        | Web search queries        | ❌ No geo-filtered queries          |
| `ResearchResult`                     | Global data only          | ❌ No local/global split            |
| `specialized-evaluators.ts`          | Market Analyst prompt     | ❌ No location context              |
| `market.yaml` questions              | Generic questions         | ❌ No local market questions        |
| `evaluation.md` output               | Single market section     | ❌ No local/global sections         |

---

## Proposed Architecture

### New Evaluation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROPOSED EVALUATION FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. RESEARCH PHASE (research.ts) - ENHANCED                         │
│     ├─ Query 1: "pet market Australia 2025" (LOCAL)                 │
│     ├─ Query 2: "pet market global 2025" (GLOBAL)                   │
│     └─ Returns: GeographicResearchResult {                          │
│            localMarket: { size, competitors, trends, barriers }     │
│            globalMarket: { size, competitors, trends, barriers }    │
│        }                                                            │
│                                                                     │
│  2. PROFILE CONTEXT (profile-context.ts) - ENHANCED                 │
│     └─ formatProfileForCategory('market') now includes:             │
│        - Creator's primary location (country, city)                 │
│        - Network WITH geographic distribution                       │
│        - Local vs remote connection breakdown                       │
│                                                                     │
│  3. MARKET EVALUATOR (specialized-evaluators.ts) - ENHANCED         │
│     └─ New system prompt sections:                                  │
│        - "Local Market Context (Creator Location: Australia)"       │
│        - "Global Market Opportunity"                                │
│        - "Geographic Expansion Path"                                │
│     └─ Evaluates M1-M5 for BOTH local and global                    │
│                                                                     │
│  4. OUTPUT (evaluation.md) - NEW FORMAT                             │
│     └─ ### Local Market Analysis (Australia)                        │
│        - Local TAM/SAM/SOM                                          │
│        - Local competitors                                          │
│        - Local entry barriers                                       │
│        - Local timing assessment                                    │
│     └─ ### Global Market Opportunity                                │
│        - Global TAM potential                                       │
│        - Key markets to expand to                                   │
│        - Geographic expansion strategy                              │
│     └─ ### Geographic Recommendation                                │
│        - Start local vs. go global first?                           │
│        - Network leverage assessment by region                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Implementation Plan

### Phase 1: Schema & Data Structure Updates

#### 1.1 Extend ProfileContext Schema

**File:** `utils/schemas.ts`

Add geographic context to the ProfileContext schema:

```typescript
export const ProfileContextSchema = z.object({
  // Existing fields
  goalsContext: z.string(),
  passionContext: z.string(),
  skillsContext: z.string(),
  networkContext: z.string(),
  lifeStageContext: z.string(),

  // NEW: Geographic context
  geographicContext: z
    .object({
      primaryLocation: z
        .object({
          country: z.string(),
          city: z.string().optional(),
          timezone: z.string().optional(),
        })
        .optional(),
      currency: z.string().optional(),
      networkGeography: z
        .object({
          localConnections: z.string(), // Connections in user's country
          regionalConnections: z.string(), // Connections in nearby regions
          globalConnections: z.string(), // Connections worldwide
        })
        .optional(),
    })
    .optional(),

  // Raw data
  profile: UserProfileSchema.optional(),
  ideaOverrides: IdeaProfileLinkSchema.optional(),
});
```

#### 1.2 Extend ResearchResult Interface

**File:** `agents/research.ts`

Add geographic breakdown to research results:

```typescript
export interface GeographicMarketData {
  region: string; // e.g., "Australia", "Global", "United States"
  marketSize: {
    tam: string | null;
    sam: string | null;
    som: string | null;
    sources: string[];
  };
  competitors: {
    players: string[];
    intensity: "low" | "moderate" | "high" | "intense";
    sources: string[];
  };
  entryBarriers: {
    regulatory: string | null;
    capital: string | null;
    relationships: string | null;
    sources: string[];
  };
  marketTiming: {
    readiness: "emerging" | "growing" | "mature" | "declining";
    catalysts: string[];
  };
}

export interface ResearchResult {
  // Existing fields (keep for backwards compatibility)
  marketSize: {
    userClaim: string | null;
    verified: string | null;
    sources: string[];
  };
  competitors: {
    userMentioned: string[];
    discovered: string[];
    sources: string[];
  };
  trends: { direction: string; evidence: string; sources: string[] };
  techFeasibility: {
    assessment: string;
    examples: string[];
    sources: string[];
  };

  // NEW: Geographic breakdown
  geographicAnalysis?: {
    localMarket: GeographicMarketData | null; // User's country
    globalMarket: GeographicMarketData | null; // Worldwide
    expansionMarkets?: GeographicMarketData[]; // Key expansion opportunities
    creatorLocation: { country: string; city?: string } | null;
  };

  timestamp: string;
  searchesPerformed: number;
}
```

### Phase 2: Research Phase Enhancement

#### 2.1 Geographic Research Queries

**File:** `agents/research.ts`

Modify `conductPreEvaluationResearch` to accept geographic context:

```typescript
export async function conductPreEvaluationResearch(
  ideaContent: string,
  claims: ExtractedClaims,
  costTracker: CostTracker,
  creatorLocation?: { country: string; city?: string }, // NEW PARAMETER
): Promise<ResearchResult> {
  // Build geographic-specific queries
  const localQueries = creatorLocation
    ? [
        `${claims.domain} market ${creatorLocation.country} ${currentYear}`,
        `${claims.domain} competitors ${creatorLocation.country}`,
        `${claims.domain} regulations ${creatorLocation.country}`,
      ]
    : [];

  const globalQueries = [
    `${claims.domain} market global ${currentYear}`,
    `${claims.domain} top competitors worldwide`,
    `${claims.domain} market trends ${currentYear}`,
  ];

  // Run both query sets
  // Synthesize into GeographicMarketData structures
}
```

#### 2.2 Update Research Prompt

**File:** `agents/research.ts`

Update the research prompt to request geographic breakdown:

```typescript
const researchPrompt = `You are a market research analyst. Use WebSearch to research this business idea.

## Creator Context
${creatorLocation ? `The creator is based in **${creatorLocation.city || ""}, ${creatorLocation.country}**.` : "Creator location unknown."}

## Research Tasks

### Local Market Research (${creatorLocation?.country || "Unknown"})
1. Market size for: ${claims.domain} market ${creatorLocation?.country || ""} ${currentYear}
2. Key LOCAL competitors in: ${claims.domain} ${creatorLocation?.country || ""}
3. LOCAL regulations/barriers for: ${claims.domain} ${creatorLocation?.country || ""}

### Global Market Research
4. Global market size for: ${claims.domain} market ${currentYear}
5. Top GLOBAL competitors in: ${claims.domain}
6. Global market trends and growth rates

## Output Format
{
  "localMarket": {
    "region": "${creatorLocation?.country || "Unknown"}",
    "marketSize": { "tam": "...", "sam": "...", "sources": [...] },
    "competitors": { "players": [...], "intensity": "...", "sources": [...] },
    "entryBarriers": { "regulatory": "...", "capital": "...", "sources": [...] },
    "marketTiming": { "readiness": "...", "catalysts": [...] }
  },
  "globalMarket": {
    "region": "Global",
    "marketSize": { "tam": "...", "sources": [...] },
    "competitors": { "players": [...], "intensity": "...", "sources": [...] },
    "entryBarriers": { ... },
    "marketTiming": { ... }
  }
}
`;
```

### Phase 3: Profile Context Enhancement

#### 3.1 Geographic Profile Formatting

**File:** `utils/profile-context.ts`

Add new function to extract geographic context:

```typescript
export function extractGeographicContext(
  profile: UserProfile | null,
): ProfileContext["geographicContext"] {
  if (!profile) return undefined;

  const hasLocation = profile.country || profile.city;
  if (!hasLocation) return undefined;

  // Analyze industry connections for geographic distribution
  const connections = profile.industryConnections || [];
  const networkText = profile.professionalNetwork || "";
  const communities = profile.communityAccess || [];

  // Simple heuristic: check if network mentions are local or global
  const localIndicators = [profile.country, profile.city].filter(Boolean);
  const hasLocalNetwork =
    connections.some((c) =>
      localIndicators.some((loc) =>
        c.description?.toLowerCase().includes(loc!.toLowerCase()),
      ),
    ) ||
    localIndicators.some((loc) =>
      networkText.toLowerCase().includes(loc!.toLowerCase()),
    );

  return {
    primaryLocation: {
      country: profile.country || "Unknown",
      city: profile.city,
      timezone: profile.timezone,
    },
    currency: profile.currency,
    networkGeography: {
      localConnections: hasLocalNetwork
        ? "Has local connections"
        : "Limited local connections",
      regionalConnections: "Not specified",
      globalConnections:
        connections.length > 0
          ? "Has industry connections"
          : "Limited global network",
    },
  };
}
```

#### 3.2 Update Market Profile Formatting

**File:** `utils/profile-context.ts`

Modify `formatProfileForCategory` for market category:

```typescript
case 'market':
  const geoContext = extractGeographicContext(profile.profile);

  return `## Creator Context (for Market Assessment)

### Creator Location
${geoContext?.primaryLocation ?
  `**Primary Location:** ${geoContext.primaryLocation.city || ''}, ${geoContext.primaryLocation.country}
**Timezone:** ${geoContext.primaryLocation.timezone || 'Not specified'}
**Currency:** ${geoContext.currency || 'USD'}` :
  '**Location:** Not specified'}

### Network by Geography
${geoContext?.networkGeography ?
  `**Local Network (${geoContext.primaryLocation?.country}):** ${geoContext.networkGeography.localConnections}
**Regional Network:** ${geoContext.networkGeography.regionalConnections}
**Global Network:** ${geoContext.networkGeography.globalConnections}` :
  '**Network:** ${profile.networkContext}'}

### Industry Connections
${profile.networkContext}

### Community Access
${extractField(profile.networkContext, 'Community') || 'Not specified'}

**IMPORTANT**:
1. Evaluate market opportunity BOTH locally (${geoContext?.primaryLocation?.country || 'creator location'}) AND globally.
2. Consider whether the creator's network helps with LOCAL entry barriers (M4).
3. Assess if timing (M5) differs between local and global markets.
4. Recommend whether to start locally or go global first.`;
```

### Phase 4: Market Evaluator Enhancement

#### 4.1 Update Market Analyst System Prompt

**File:** `agents/specialized-evaluators.ts`

Enhance the Market Analyst evaluator:

```typescript
market: {
  id: 'evaluator-market',
  name: 'Market Analyst',
  category: 'market',
  expertise: 'Market sizing, competitive dynamics, timing analysis, GEOGRAPHIC market segmentation',
  systemPrompt: `You are a Market Analysis Expert evaluating ideas.

Your specialization:
- Deep understanding of market dynamics
- Experience in competitive analysis
- Expertise in market sizing (TAM/SAM/SOM)
- Skills in trend analysis and timing assessment
- **Geographic market segmentation expertise**

## Your Evaluation Focus

You evaluate the MARKET category with a **GEOGRAPHIC LENS**.

For EACH criterion (M1-M5), provide analysis for:
1. **LOCAL MARKET** (creator's country/region)
2. **GLOBAL MARKET** (worldwide opportunity)
3. **GEOGRAPHIC RECOMMENDATION** (where to start, expansion path)

### M1: Market Size
- Local TAM/SAM/SOM (creator's country)
- Global TAM/SAM/SOM
- Market size comparison

### M2: Market Growth
- Local growth trends
- Global growth trends
- Regional growth variations

### M3: Competition Intensity
- Local competitive landscape
- Global competitive landscape
- Blue ocean opportunities by region

### M4: Entry Barriers
- Local regulatory barriers
- Local relationship/network barriers
- Global scaling barriers
- **How does creator's network help locally?**

### M5: Timing
- Local market readiness
- Global market readiness
- Regional timing variations

## Scoring Guidelines
- Score each criterion considering BOTH local and global
- Weight local more heavily if creator has strong local network
- Weight global more heavily if idea is inherently global (e.g., software)
- Note when local and global scores would differ significantly

## Output Format Enhancement
For each criterion reasoning, structure as:
"LOCAL: [analysis]. GLOBAL: [analysis]. OVERALL: [weighted assessment]."
`
}
```

#### 4.2 Update Research Formatting for Market

**File:** `agents/research.ts`

Modify `formatResearchForCategory`:

```typescript
export function formatResearchForCategory(
  research: ResearchResult | null,
  category: string,
): string {
  if (!research) return "";

  if (category === "market") {
    const geo = research.geographicAnalysis;

    let output = `## External Research (Web Search Results)\n\n`;

    if (geo?.localMarket) {
      output += `### Local Market (${geo.creatorLocation?.country || "Unknown Region"})\n\n`;
      output += `**Market Size:**\n`;
      output += `- TAM: ${geo.localMarket.marketSize.tam || "Not found"}\n`;
      output += `- SAM: ${geo.localMarket.marketSize.sam || "Not found"}\n\n`;
      output += `**Local Competitors:** ${geo.localMarket.competitors.players.join(", ") || "None discovered"}\n`;
      output += `**Competition Intensity:** ${geo.localMarket.competitors.intensity}\n\n`;
      output += `**Entry Barriers:**\n`;
      output += `- Regulatory: ${geo.localMarket.entryBarriers.regulatory || "Unknown"}\n`;
      output += `- Capital: ${geo.localMarket.entryBarriers.capital || "Unknown"}\n\n`;
      output += `**Market Timing:** ${geo.localMarket.marketTiming.readiness}\n\n`;
    }

    if (geo?.globalMarket) {
      output += `### Global Market\n\n`;
      output += `**Market Size:**\n`;
      output += `- Global TAM: ${geo.globalMarket.marketSize.tam || "Not found"}\n\n`;
      output += `**Global Competitors:** ${geo.globalMarket.competitors.players.join(", ") || "None discovered"}\n`;
      output += `**Competition Intensity:** ${geo.globalMarket.competitors.intensity}\n\n`;
      output += `**Market Timing:** ${geo.globalMarket.marketTiming.readiness}\n\n`;
    }

    // Include original format for backwards compatibility
    output += `### Combined Research Summary\n\n`;
    output += `**Market Size (User Claim vs Verified):**\n`;
    output += `- User claimed: ${research.marketSize.userClaim || "Not specified"}\n`;
    output += `- Verified: ${research.marketSize.verified || "Could not verify"}\n\n`;

    return output;
  }

  // ... rest of categories unchanged
}
```

### Phase 5: Evaluation Output Enhancement

#### 5.1 New Evaluation Output Format

**File:** `agents/synthesis.ts` (and related output formatting)

Update evaluation markdown format to include geographic sections:

```markdown
### Market

**Market Size:** 8/10

> **LOCAL (Australia):** The Australian pet care market is valued at $15B with
> healthy growth. The AI pet health segment is nascent but growing.
>
> **GLOBAL:** The global pet market is $320B with the AI segment at $4.2B.
> Explosive growth projected (12.5% CAGR).
>
> **GEOGRAPHIC INSIGHT:** Strong global opportunity, but local market is smaller
> and less competitive - good testing ground before global expansion.

**Market Growth:** 9/10

> **LOCAL:** Australian market growing at 8% CAGR, driven by pet humanization.
>
> **GLOBAL:** Global AI pet care growing at 12.5% CAGR with tailwinds from
> smartphone ubiquity and AI awareness.
>
> **GEOGRAPHIC INSIGHT:** Global growth slightly outpaces local. Consider
> local launch then rapid international expansion.

**Competition Intensity:** 4/10

> **LOCAL:** Limited direct AI pet health competitors in Australia. Opportunity
> to establish market leadership locally.
>
> **GLOBAL:** Crowded with TTcare, PetPace, FitBark, and major players like
> Mars and Zoetis investing heavily.
>
> **GEOGRAPHIC INSIGHT:** Blue ocean locally, red ocean globally. Strong case
> for local-first strategy.

**Entry Barriers:** 5/10

> **LOCAL:** Australian health regulations less stringent for pet apps.
> Creator's Sydney network may help with local vet partnerships.
>
> **GLOBAL:** Significant barriers: training data from competitors, established
> vet networks, brand trust. Would need substantial resources.
>
> **GEOGRAPHIC INSIGHT:** Low local barriers + creator network advantage.
> High global barriers without significant funding.

**Timing:** 7/10

> **LOCAL:** Australian market ready but smaller. Good timing for first-mover
> advantage locally.
>
> **GLOBAL:** Slightly late to the global party - significant investment already
> happened 2020-2024. Still opportunity but requires differentiation.
>
> **GEOGRAPHIC INSIGHT:** Perfect timing locally, acceptable timing globally
> with the right differentiation strategy.

---

## Geographic Market Summary

### Recommendation: Start Local, Scale Global

**Local Market Score:** 7.2/10

- Smaller but growing market
- Less competition (blue ocean opportunity)
- Lower entry barriers
- Creator's network advantage in Sydney

**Global Market Score:** 5.8/10

- Massive market opportunity
- Intense competition
- High entry barriers
- No significant network advantage

**Strategy:** Launch in Australia first to:

1. Validate product-market fit with lower risk
2. Build initial traction and case studies
3. Develop AI models with real user data
4. Prepare for global expansion with proof points

**Expansion Path:**

1. Australia (Year 1) - Prove model, build brand
2. New Zealand (Year 2) - Similar market, easy expansion
3. UK/US (Year 3+) - With funding and proven product
```

### Phase 6: Dynamic Questions Enhancement

#### 6.1 Add Geographic Market Questions

**File:** `questions/market.yaml`

Add new questions for geographic context:

```yaml
# M1: Market Size - Geographic Breakdown
- id: M1_GEO_LOCAL
  criterion: M1
  text: "What's the market size in your local country/region specifically?"
  type: factual
  priority: important
  idea_types: [business]
  depends_on: [M1_TAM]
  follow_ups: null

- id: M1_GEO_FOCUS
  criterion: M1
  text: "Are you targeting your local market first, or going global from day one?"
  type: strategic
  priority: important
  idea_types: [business]
  depends_on: null
  follow_ups: [M1_GEO_EXPANSION]

- id: M1_GEO_EXPANSION
  criterion: M1
  text: "If starting locally, what markets would you expand to and when?"
  type: strategic
  priority: nice-to-have
  idea_types: [business]
  depends_on: [M1_GEO_FOCUS]
  follow_ups: null

# M3: Competition - Geographic Context
- id: M3_GEO_LOCAL
  criterion: M3
  text: "Who are your competitors in your local market specifically?"
  type: factual
  priority: important
  idea_types: null
  depends_on: [M3_COMPETITORS]
  follow_ups: null

# M4: Entry Barriers - Geographic Context
- id: M4_GEO_BARRIERS
  criterion: M4
  text: "What barriers are specific to your local market? (regulations, licensing, etc.)"
  type: factual
  priority: important
  idea_types: null
  depends_on: [M4_BARRIERS]
  follow_ups: null

- id: M4_GEO_NETWORK
  criterion: M4
  text: "Do you have local connections that could help overcome these barriers?"
  type: analytical
  priority: important
  idea_types: null
  depends_on: [M4_GEO_BARRIERS]
  follow_ups: null
```

### Phase 7: Frontend Updates

#### 7.1 Update Evaluation Scorecard

**File:** `frontend/src/components/EvaluationScorecard.tsx`

Add geographic breakdown visualization:

```tsx
// Add new component for geographic market breakdown
interface GeographicMarketProps {
  localScore: number;
  globalScore: number;
  localAnalysis: string;
  globalAnalysis: string;
  recommendation: string;
}

function GeographicMarketBreakdown({
  localScore,
  globalScore,
  localAnalysis,
  globalAnalysis,
  recommendation,
}: GeographicMarketProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Geographic Market Breakdown
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded p-3 border">
          <div className="text-xs text-gray-500 uppercase mb-1">
            Local Market
          </div>
          <div className={`text-2xl font-bold ${getScoreColor(localScore)}`}>
            {localScore.toFixed(1)}/10
          </div>
          <p className="text-xs text-gray-600 mt-2">{localAnalysis}</p>
        </div>
        <div className="bg-white rounded p-3 border">
          <div className="text-xs text-gray-500 uppercase mb-1">
            Global Market
          </div>
          <div className={`text-2xl font-bold ${getScoreColor(globalScore)}`}>
            {globalScore.toFixed(1)}/10
          </div>
          <p className="text-xs text-gray-600 mt-2">{globalAnalysis}</p>
        </div>
      </div>
      <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-800">
        <strong>Strategy:</strong> {recommendation}
      </div>
    </div>
  );
}
```

---

## Implementation Order & Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION SEQUENCE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE 1: Schema Updates (No breaking changes)                      │
│  ├─ 1.1 Extend ProfileContext schema                                │
│  ├─ 1.2 Extend ResearchResult interface                             │
│  └─ Estimated: 30 lines changed                                     │
│                                                                     │
│  PHASE 2: Profile Context (Builds on Phase 1)                       │
│  ├─ 2.1 extractGeographicContext() function                         │
│  ├─ 2.2 Update formatProfileForCategory('market')                   │
│  ├─ 2.3 Update generateProfileContext() in profile.ts               │
│  └─ Estimated: 80 lines changed                                     │
│                                                                     │
│  PHASE 3: Research Enhancement (Builds on Phase 1)                  │
│  ├─ 3.1 Add creatorLocation parameter to research                   │
│  ├─ 3.2 Geographic query builder                                    │
│  ├─ 3.3 Update research prompt for geo breakdown                    │
│  ├─ 3.4 Update formatResearchForCategory('market')                  │
│  └─ Estimated: 150 lines changed                                    │
│                                                                     │
│  PHASE 4: Evaluator Enhancement (Builds on Phases 2, 3)             │
│  ├─ 4.1 Update Market Analyst system prompt                         │
│  ├─ 4.2 Update runSpecializedEvaluator to pass geo context          │
│  └─ Estimated: 50 lines changed                                     │
│                                                                     │
│  PHASE 5: Output Formatting (Builds on Phase 4)                     │
│  ├─ 5.1 Update evaluation.md output format                          │
│  ├─ 5.2 Add Geographic Market Summary section                       │
│  └─ Estimated: 100 lines changed                                    │
│                                                                     │
│  PHASE 6: Questions Enhancement (Independent)                       │
│  ├─ 6.1 Add geographic market questions to market.yaml              │
│  ├─ 6.2 Update question loader for new questions                    │
│  └─ Estimated: 50 lines added                                       │
│                                                                     │
│  PHASE 7: Frontend Updates (Builds on Phase 5)                      │
│  ├─ 7.1 GeographicMarketBreakdown component                         │
│  ├─ 7.2 Update EvaluationScorecard                                  │
│  └─ Estimated: 150 lines added                                      │
│                                                                     │
│  TOTAL ESTIMATED: ~610 lines changed/added                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Change Summary

| File                                              | Change Type | Changes                                                     |
| ------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `utils/schemas.ts`                                | Modify      | Add geographicContext to ProfileContextSchema               |
| `agents/research.ts`                              | Modify      | Add GeographicMarketData interface, update research queries |
| `utils/profile-context.ts`                        | Modify      | Add extractGeographicContext(), update market formatting    |
| `scripts/profile.ts`                              | Modify      | Update generateProfileContext() for geo data                |
| `agents/specialized-evaluators.ts`                | Modify      | Update Market Analyst prompt                                |
| `agents/synthesis.ts`                             | Modify      | Update output formatting for geo sections                   |
| `questions/market.yaml`                           | Modify      | Add 6 new geographic questions                              |
| `frontend/src/components/EvaluationScorecard.tsx` | Modify      | Add GeographicMarketBreakdown                               |
| `database/migrations/009_profile_geography.sql`   | Create      | Ensure geo columns exist (already present)                  |

---

## Backwards Compatibility

### Existing Evaluations

- No changes to existing evaluation.md files
- New format only applies to new evaluations

### Missing Profile Location

- If user profile has no location: Fall back to global-only analysis
- Add prompt: "For more accurate market analysis, add your location to your profile"

### Research Fallback

- If geo-specific search fails: Use global results
- Log warning but don't fail evaluation

---

## Testing Strategy

### Unit Tests

1. `extractGeographicContext()` with various profile configurations
2. Geographic query builder with different locations
3. Research result parsing with geo data

### Integration Tests

1. Full evaluation with geo-enabled profile
2. Full evaluation with profile missing location
3. Research phase with/without location

### E2E Test (via Puppeteer)

1. Create idea through UI
2. Link "ned" profile (has Australia/Sydney)
3. Run evaluation
4. Verify evaluation.md contains:
   - "Local Market (Australia)" section
   - "Global Market" section
   - Geographic recommendation

---

## Risk Assessment

| Risk                                     | Likelihood | Impact | Mitigation                              |
| ---------------------------------------- | ---------- | ------ | --------------------------------------- |
| Geo-specific search returns poor results | Medium     | Low    | Fall back to global search              |
| Increased token usage from dual analysis | Medium     | Medium | Use efficient prompting, cache research |
| Breaking existing evaluations            | Low        | High   | Backwards compatible schema             |
| Profile location data incomplete         | Medium     | Low    | Graceful fallback to global-only        |
| Research API rate limits                 | Low        | Medium | Batch geographic queries                |

---

## Success Criteria

1. **Evaluation contains geographic sections**: Local Market and Global Market clearly separated
2. **Profile location is used**: Research queries include user's country
3. **M4 (Entry Barriers) references local network**: Connects creator's connections to local barriers
4. **Geographic recommendation present**: Clear guidance on local vs global strategy
5. **Backwards compatible**: Existing evaluations still work, profiles without location still evaluate

---

## Next Steps After Approval

1. Create feature branch: `feature/geographic-market-analysis`
2. Implement Phase 1 (schemas)
3. Implement Phase 2 (profile context)
4. Implement Phase 3 (research)
5. Implement Phase 4 (evaluator)
6. Implement Phase 5 (output)
7. Implement Phase 6 (questions)
8. Implement Phase 7 (frontend)
9. Run E2E test with ned profile
10. Verify evaluation output meets success criteria
