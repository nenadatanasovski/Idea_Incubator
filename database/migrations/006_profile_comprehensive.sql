-- Migration: Add comprehensive profile fields for accurate Personal Fit evaluation
-- These fields are critical for first-principles assessment of idea-person fit

-- Geographic Context (affects market access, costs, regulations)
ALTER TABLE user_profiles ADD COLUMN country TEXT;
ALTER TABLE user_profiles ADD COLUMN city TEXT;
ALTER TABLE user_profiles ADD COLUMN timezone TEXT;

-- Financial Reality (the actual numbers that matter)
ALTER TABLE user_profiles ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE user_profiles ADD COLUMN current_monthly_income INTEGER;  -- in their currency
ALTER TABLE user_profiles ADD COLUMN target_monthly_income INTEGER;   -- goal income
ALTER TABLE user_profiles ADD COLUMN monthly_expenses INTEGER;        -- burn rate
ALTER TABLE user_profiles ADD COLUMN available_capital INTEGER;       -- money to invest in ideas
ALTER TABLE user_profiles ADD COLUMN total_savings INTEGER;           -- for true runway calc

-- Demographics (affects risk capacity, credibility, time horizon)
ALTER TABLE user_profiles ADD COLUMN age_range TEXT;  -- '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
ALTER TABLE user_profiles ADD COLUMN dependents INTEGER DEFAULT 0;    -- number of people depending on you
ALTER TABLE user_profiles ADD COLUMN education_level TEXT;            -- high_school, bachelors, masters, phd, other
ALTER TABLE user_profiles ADD COLUMN education_field TEXT;            -- area of study

-- Communication & Reach (distribution advantages)
ALTER TABLE user_profiles ADD COLUMN languages TEXT;                  -- JSON array of languages
ALTER TABLE user_profiles ADD COLUMN social_media_following INTEGER;  -- total across platforms
ALTER TABLE user_profiles ADD COLUMN existing_audience TEXT;          -- description of audience

-- Resource Access
ALTER TABLE user_profiles ADD COLUMN has_investor_access INTEGER DEFAULT 0;  -- boolean
ALTER TABLE user_profiles ADD COLUMN has_existing_customers INTEGER DEFAULT 0;  -- boolean
ALTER TABLE user_profiles ADD COLUMN resource_notes TEXT;             -- other resources available
