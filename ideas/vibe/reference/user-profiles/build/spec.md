---
id: "user-profiles"
title: "User Profiles System"
idea_type: "feature_internal"
creator: "system"
created: "2026-01-10"
updated: "2026-01-10"
status: "approved"
version: "1.0"
complexity: "medium"
---

# Technical Specification: User Profiles System

## Context References

**Required Reading:**
- [x] `README.md` - Idea overview
- [x] `planning/brief.md` - Feature brief

**Patterns to Follow:**
- Section: "Database Patterns" - Use SQLite with TEXT timestamps
- Section: "API Routes" - Express router patterns
- Section: "File Uploads" - Multer middleware for file handling

---

## Overview

**Objective:**
Implement a user profiles system that extends basic auth with profile information, avatar support, and user preferences. This enables personalization and collaborative features.

**Success Criteria:**
1. Users can view and update their profile information
2. Avatar uploads work with automatic resizing to 32, 64, 128, 256px
3. User preferences persist across sessions
4. Profile endpoints are properly authenticated
5. Missing profiles are created automatically on first access

**Out of Scope:**
- OAuth flow implementation (just token storage)
- Profile privacy settings
- Profile search and discovery
- Activity feeds

---

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Source |
|----|-------------|----------|---------------------|--------|
| FR-001 | Profile CRUD | Must | Create, read, update profile info | Brief |
| FR-002 | Avatar upload | Must | Upload image up to 5MB, auto-resize | Brief |
| FR-003 | Avatar serving | Must | Serve resized avatars via static route | Brief |
| FR-004 | Preferences | Must | Get/set theme, notifications, language | Brief |
| FR-005 | Auto-creation | Should | Create profile on first access | Brief |
| FR-006 | Public profiles | Should | View another user's public info | Brief |

### Detailed Requirements

#### FR-001: Profile CRUD

**Description:** Users can manage their profile information including display name, bio, location, and website.

**User Story:** As a user, I want to manage my profile so that other users can learn about me.

**Acceptance Criteria:**
- [x] GET /api/profile returns current user's profile
- [x] PUT /api/profile updates profile fields
- [x] Profile includes: display_name, bio, location, website
- [x] Validation for field lengths and URL format

#### FR-002: Avatar Upload

**Description:** Users can upload an avatar image which is automatically resized.

**User Story:** As a user, I want to upload an avatar so that my profile is recognizable.

**Acceptance Criteria:**
- [x] POST /api/profile/avatar accepts image upload
- [x] Maximum file size: 5MB
- [x] Accepted formats: JPEG, PNG, GIF, WebP
- [x] Images resized to 32, 64, 128, 256px squares
- [x] Original image deleted after processing

#### FR-003: Preferences Management

**Description:** Users can manage their preferences for theme, notifications, and localization.

**User Story:** As a user, I want to set my preferences so the app works how I like.

**Acceptance Criteria:**
- [x] GET /api/profile/preferences returns preferences
- [x] PUT /api/profile/preferences updates preferences
- [x] Preferences include: theme, language, timezone, notification settings

---

## Non-Functional Requirements

| Category | Requirement | Target | Validation Method |
|----------|-------------|--------|-------------------|
| Performance | Avatar upload | < 3s for 5MB | Timing test |
| Storage | Avatar sizes | ~200KB per user | Disk usage check |
| Security | Image validation | No code execution | File type check |
| Availability | Profile access | 99.9% | Monitoring |

---

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────┐
│                    User Profile System                   │
├─────────────┬─────────────┬─────────────┬──────────────┤
│   Profile   │  Preferences │   Avatar    │   Linked     │
│   Service   │   Manager    │   Handler   │   Accounts   │
├─────────────┼─────────────┼─────────────┼──────────────┤
│  profiles   │ preferences │   assets/   │   linked_    │
│  (table)    │  (table)    │  avatars/   │  accounts    │
└─────────────┴─────────────┴─────────────┴──────────────┘
```

### New Files

| File Path | Purpose | Owner |
|-----------|---------|-------|
| `database/migrations/026_user_profiles.sql` | Create profile tables | Build Agent |
| `types/profile.ts` | TypeScript interfaces | Build Agent |
| `server/services/profile-service.ts` | Profile CRUD operations | Build Agent |
| `server/services/avatar-handler.ts` | Image upload and resize | Build Agent |
| `server/services/preferences-manager.ts` | Preference operations | Build Agent |
| `server/routes/profile.ts` | Profile API endpoints | Build Agent |

### Modified Files

| File Path | Changes | Owner |
|-----------|---------|-------|
| `server/api.ts` | Mount profile routes | Build Agent |

### Files to Avoid

| File Path | Reason | Owner |
|-----------|--------|-------|
| `server/routes/auth.ts` | Authentication system | Auth team |
| `server/middleware/auth.ts` | Auth middleware | Auth team |

---

## API Design

### Endpoints

| Endpoint | Method | Description | Auth | Request | Response |
|----------|--------|-------------|------|---------|----------|
| `/api/profile` | GET | Get current profile | Required | - | Profile |
| `/api/profile` | PUT | Update profile | Required | ProfileUpdate | Profile |
| `/api/profile/avatar` | POST | Upload avatar | Required | multipart/form-data | { url } |
| `/api/profile/avatar` | DELETE | Remove avatar | Required | - | { success } |
| `/api/profile/preferences` | GET | Get preferences | Required | - | Preferences |
| `/api/profile/preferences` | PUT | Update preferences | Required | PreferencesUpdate | Preferences |
| `/api/profile/:userId` | GET | Get public profile | Optional | - | PublicProfile |

### Request/Response Examples

#### GET /api/profile

**Response:**
```json
{
  "id": "profile-123",
  "userId": "user-456",
  "displayName": "Jane Developer",
  "bio": "Full-stack developer building cool things",
  "location": "San Francisco, CA",
  "website": "https://jane.dev",
  "avatarPath": "/assets/avatars/user-456/256.jpg",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-10T12:00:00Z"
}
```

#### PUT /api/profile

**Request:**
```json
{
  "displayName": "Jane Developer",
  "bio": "Full-stack developer building cool things",
  "location": "San Francisco, CA",
  "website": "https://jane.dev"
}
```

**Response:**
```json
{
  "id": "profile-123",
  "userId": "user-456",
  "displayName": "Jane Developer",
  "bio": "Full-stack developer building cool things",
  "location": "San Francisco, CA",
  "website": "https://jane.dev",
  "avatarPath": "/assets/avatars/user-456/256.jpg",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-10T12:30:00Z"
}
```

#### POST /api/profile/avatar

**Request:** multipart/form-data with `avatar` field

**Response:**
```json
{
  "url": "/assets/avatars/user-456/256.jpg",
  "sizes": {
    "32": "/assets/avatars/user-456/32.jpg",
    "64": "/assets/avatars/user-456/64.jpg",
    "128": "/assets/avatars/user-456/128.jpg",
    "256": "/assets/avatars/user-456/256.jpg"
  }
}
```

#### GET /api/profile/preferences

**Response:**
```json
{
  "id": "pref-789",
  "userId": "user-456",
  "theme": "dark",
  "language": "en",
  "timezone": "America/Los_Angeles",
  "emailNotifications": true,
  "pushNotifications": false,
  "weeklyDigest": true
}
```

---

## Data Models

### Database Schema

```sql
-- Migration 026: User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    display_name TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    avatar_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    theme TEXT DEFAULT 'system',
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    email_notifications INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    weekly_digest INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS linked_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_username TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_provider ON linked_accounts(provider, provider_user_id);
```

### TypeScript Interfaces

```typescript
export interface UserProfile {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdateInput {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PreferencesUpdateInput {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  weeklyDigest?: boolean;
}

export interface LinkedAccount {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  providerUsername: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface PublicProfile {
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
}
```

---

## Dependencies

### Internal Dependencies

| Dependency | Status | Blocks | Owner |
|------------|--------|--------|-------|
| Database (db.ts) | Ready | None | Core |
| Express app | Ready | None | Core |
| Auth middleware | Ready | None | Auth |
| Users table | Ready | None | Auth |

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18 | Web framework (existing) |
| multer | ^1.4 | File upload handling |
| sharp | ^0.33 | Image resizing |

---

## Known Gotchas

| ID | Gotcha | Source | Confidence |
|----|--------|--------|------------|
| G-001 | Use TEXT for SQLite timestamps, not DATETIME | Knowledge Base | High |
| G-002 | Multer stores files in memory by default - use diskStorage | Experience | High |
| G-003 | Sharp requires native bindings - ensure node_modules rebuilt | Experience | Medium |
| G-004 | Avatar directory must exist before writing | Experience | High |
| G-005 | Use INTEGER 0/1 for booleans in SQLite | Knowledge Base | High |

---

## Validation Strategy

### Unit Tests

| Test File | Coverage Target | Priority |
|-----------|-----------------|----------|
| `tests/profile.test.ts` | 80% | High |
| `tests/avatar.test.ts` | 70% | Medium |
| `tests/preferences.test.ts` | 80% | High |

### Validation Commands

```bash
# TypeScript check
npx tsc --noEmit

# Run tests
npm test -- --grep "profile"

# Manual validation
curl http://localhost:3000/api/profile -H "Authorization: Bearer $TOKEN" | jq
```

### Manual Validation

- [ ] Create profile with all fields
- [ ] Upload avatar, verify all sizes created
- [ ] Delete avatar, verify files removed
- [ ] Update preferences, verify persistence
- [ ] Access public profile of another user

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Image processing fails | Low | Medium | Fallback to default avatar |
| Storage grows too large | Medium | Low | Add cleanup for orphaned files |
| Profile not auto-created | Low | High | Add middleware check |

---

## Implementation Notes

1. Create profile and preferences records when user first accesses endpoint
2. Use sharp for image processing - it's fast and handles EXIF rotation
3. Store avatars in `assets/avatars/{user_id}/` directory
4. Serve avatars via Express static middleware
5. Use multer with file size limit for upload handling
6. Validate image type by checking magic bytes, not just extension

---

## Approval

- [x] **Auto-Approved** - Complexity below threshold

**Approved By:** System
**Approved At:** 2026-01-10
**Notes:** Medium complexity, well-defined scope

---

*Generated for Spec Agent reference*
*See `tasks.md` for implementation breakdown*
