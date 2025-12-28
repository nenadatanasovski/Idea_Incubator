-- Migration: Remove restrictive CHECK constraints to allow more flexible values
-- The original constraints were too restrictive for the comprehensive profile form

-- SQLite doesn't support ALTER TABLE to modify constraints directly
-- We need to recreate the table without the constraints

-- Drop the index first
DROP INDEX IF EXISTS idx_profiles_slug;

-- Create new table without CHECK constraints
CREATE TABLE user_profiles_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    primary_goals TEXT NOT NULL,
    success_definition TEXT,
    interests TEXT,
    motivations TEXT,
    domain_connection TEXT,
    technical_skills TEXT,
    professional_experience TEXT,
    domain_expertise TEXT,
    known_gaps TEXT,
    industry_connections TEXT,
    professional_network TEXT,
    community_access TEXT,
    partnership_potential TEXT,
    employment_status TEXT,
    weekly_hours_available INTEGER,
    financial_runway_months INTEGER,
    risk_tolerance TEXT,
    other_commitments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    country TEXT,
    city TEXT,
    timezone TEXT,
    currency TEXT DEFAULT 'USD',
    current_monthly_income INTEGER,
    target_monthly_income INTEGER,
    monthly_expenses INTEGER,
    available_capital INTEGER,
    total_savings INTEGER,
    age_range TEXT,
    dependents INTEGER DEFAULT 0,
    education_level TEXT,
    education_field TEXT,
    languages TEXT,
    social_media_following INTEGER,
    existing_audience TEXT,
    has_investor_access INTEGER DEFAULT 0,
    has_existing_customers INTEGER DEFAULT 0,
    resource_notes TEXT
);

-- Copy data from old table with explicit columns
INSERT INTO user_profiles_new (
    id, name, slug, primary_goals, success_definition, interests, motivations,
    domain_connection, technical_skills, professional_experience, domain_expertise,
    known_gaps, industry_connections, professional_network, community_access,
    partnership_potential, employment_status, weekly_hours_available, financial_runway_months,
    risk_tolerance, other_commitments, created_at, updated_at, country, city, timezone,
    currency, current_monthly_income, target_monthly_income, monthly_expenses,
    available_capital, total_savings, age_range, dependents, education_level,
    education_field, languages, social_media_following, existing_audience,
    has_investor_access, has_existing_customers, resource_notes
)
SELECT
    id, name, slug, primary_goals, success_definition, interests, motivations,
    domain_connection, technical_skills, professional_experience, domain_expertise,
    known_gaps, industry_connections, professional_network, community_access,
    partnership_potential, employment_status, weekly_hours_available, financial_runway_months,
    risk_tolerance, other_commitments, created_at, updated_at, country, city, timezone,
    currency, current_monthly_income, target_monthly_income, monthly_expenses,
    available_capital, total_savings, age_range, dependents, education_level,
    education_field, languages, social_media_following, existing_audience,
    has_investor_access, has_existing_customers, resource_notes
FROM user_profiles;

-- Drop old table
DROP TABLE user_profiles;

-- Rename new table
ALTER TABLE user_profiles_new RENAME TO user_profiles;

-- Recreate index
CREATE INDEX idx_profiles_slug ON user_profiles(slug);
