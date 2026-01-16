---
id: user-profiles
title: User Profiles System
complexity: medium
creator: system
created: 2026-01-10
updated: 2026-01-10
---

# Brief: User Profiles System

## Problem

The Vibe platform lacks a comprehensive user profile system. Users cannot:

- Store personal information (bio, avatar, preferences)
- Set notification preferences
- Link social accounts for OAuth
- Manage their account settings

Additionally, the platform cannot:

- Personalize the experience based on user preferences
- Display user information in collaborative features
- Support profile-based features like @mentions

## Solution

Implement a user profiles system that:

1. Stores extended user information beyond basic auth
2. Supports avatar upload and storage
3. Manages user preferences (theme, notifications, etc.)
4. Allows linking external accounts (GitHub, Google)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Profile System                   │
├─────────────┬─────────────┬─────────────┬──────────────┤
│   Profile   │  Preferences │   Avatar    │   Linked     │
│    Core     │   Manager    │   Handler   │   Accounts   │
├─────────────┼─────────────┼─────────────┼──────────────┤
│  profiles   │ preferences │   assets/   │   linked_    │
│  (table)    │  (table)    │  avatars/   │  accounts    │
└─────────────┴─────────────┴─────────────┴──────────────┘
```

### Database Schema

Multiple related tables:

```sql
-- Core profile data
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  avatar_path TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User preferences
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  email_notifications INTEGER DEFAULT 1,
  push_notifications INTEGER DEFAULT 1,
  weekly_digest INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Linked external accounts
CREATE TABLE linked_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_username TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_linked_provider ON linked_accounts(provider, provider_user_id);
```

## MVP Scope

### In Scope

1. **Profile Service** (`server/services/profile-service.ts`)
   - CRUD operations for profiles
   - Profile validation
   - Default profile creation on user signup

2. **Avatar Handler** (`server/services/avatar-handler.ts`)
   - Image upload (max 5MB)
   - Resize to standard sizes (32, 64, 128, 256)
   - Store in `assets/avatars/{user_id}/`
   - Serve via static route

3. **Preferences Manager** (`server/services/preferences-manager.ts`)
   - Get/set user preferences
   - Preference validation
   - Default preferences on signup

4. **API Endpoints**
   - `GET /api/profile` - Get current user's profile
   - `PUT /api/profile` - Update profile
   - `POST /api/profile/avatar` - Upload avatar
   - `DELETE /api/profile/avatar` - Remove avatar
   - `GET /api/profile/preferences` - Get preferences
   - `PUT /api/profile/preferences` - Update preferences
   - `GET /api/profile/:userId` - Get public profile

5. **Database Migrations**
   - Create `user_profiles` table
   - Create `user_preferences` table
   - Create `linked_accounts` table

### Out of Scope

- OAuth flow for account linking (just store tokens)
- Profile privacy settings (public/private)
- Profile verification badges
- Activity feed on profile page
- Profile search/discovery
- Profile export

### Success Criteria

- [ ] User can create and update profile information
- [ ] Avatar upload works with images up to 5MB
- [ ] Avatars are resized to multiple sizes automatically
- [ ] Preferences are persisted and loaded correctly
- [ ] Profile endpoints are properly authenticated
- [ ] Missing profiles are created automatically

### Estimated Effort

- Database migrations: 30 minutes
- Profile service: 2 hours
- Avatar handler: 2 hours
- Preferences manager: 1 hour
- API endpoints: 2 hours
- Testing: 1 hour

**Total: ~8-10 hours**
