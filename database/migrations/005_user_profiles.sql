-- Migration 005: User Profiles for Personal Fit Evaluation
-- Adds user profile tables to provide context for Personal Fit (FT1-FT5) criteria

-- User profiles (reusable across ideas)
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                        -- Display name for the profile
    slug TEXT UNIQUE NOT NULL,                 -- kebab-case identifier

    -- FT1: Personal Goals
    primary_goals TEXT NOT NULL,               -- JSON array of goals (income, impact, learning, portfolio, lifestyle, exit)
    success_definition TEXT,                   -- What success looks like

    -- FT2: Passion & Motivation
    interests TEXT,                            -- JSON array of interest areas
    motivations TEXT,                          -- Why pursuing ideas in this space
    domain_connection TEXT,                    -- Personal connection/experience with domain

    -- FT3: Skills & Experience
    technical_skills TEXT,                     -- JSON array of technical skills
    professional_experience TEXT,              -- Years and domains of experience
    domain_expertise TEXT,                     -- JSON array of specialized knowledge areas
    known_gaps TEXT,                           -- Skills/knowledge gaps acknowledged

    -- FT4: Network & Connections
    industry_connections TEXT,                 -- JSON array of industries with depth level
    professional_network TEXT,                 -- Description of network (investors, advisors, peers)
    community_access TEXT,                     -- JSON array of communities/user groups
    partnership_potential TEXT,                -- Potential partners or relationships

    -- FT5: Life Stage & Capacity
    employment_status TEXT CHECK(employment_status IN ('employed', 'self-employed', 'unemployed', 'student', 'retired')),
    weekly_hours_available INTEGER,            -- Hours per week available
    financial_runway_months INTEGER,           -- Months of personal runway
    risk_tolerance TEXT CHECK(risk_tolerance IN ('low', 'medium', 'high', 'very_high')),
    other_commitments TEXT,                    -- Family, other projects, etc.

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Link profiles to ideas (allows different profile context per idea)
CREATE TABLE IF NOT EXISTS idea_profiles (
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    profile_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Optional idea-specific overrides (JSON)
    goals_override TEXT,                       -- Specific goals for this idea
    passion_notes TEXT,                        -- Why passionate about THIS idea
    relevant_skills TEXT,                      -- Which skills apply to THIS idea
    relevant_network TEXT,                     -- Network relevant to THIS idea
    time_commitment TEXT,                      -- Time planned for THIS idea

    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (idea_id, profile_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON user_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_idea_profiles_idea ON idea_profiles(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_profiles_profile ON idea_profiles(profile_id);

-- View for ideas with linked profiles
CREATE VIEW IF NOT EXISTS idea_with_profile AS
SELECT
    i.id as idea_id,
    i.slug as idea_slug,
    i.title as idea_title,
    p.id as profile_id,
    p.name as profile_name,
    p.primary_goals,
    p.success_definition,
    p.technical_skills,
    p.professional_experience,
    p.domain_expertise,
    p.industry_connections,
    p.employment_status,
    p.weekly_hours_available,
    p.financial_runway_months,
    p.risk_tolerance,
    ip.goals_override,
    ip.passion_notes,
    ip.relevant_skills,
    ip.relevant_network,
    ip.time_commitment
FROM ideas i
LEFT JOIN idea_profiles ip ON i.id = ip.idea_id
LEFT JOIN user_profiles p ON ip.profile_id = p.id;
