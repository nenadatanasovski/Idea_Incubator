---
id: "user-profiles"
title: "User Profiles System"
idea_type: "feature_internal"
creator: "system"
created: "2026-01-10"
updated: "2026-01-10"
spec_version: "1.0"
total_tasks: 12
completed_tasks: 0
status: "pending"
---

# Build Tasks: User Profiles System

## Summary

**Spec Reference:** `build/spec.md`
**Total Tasks:** 12
**Completed:** 0
**In Progress:** 0
**Failed:** 0
**Blocked:** 0

**Last Updated:** 2026-01-10

---

## Context Loading

### Required Context
- [x] `build/spec.md` - Technical specification
- [x] `CLAUDE.md` - Project conventions (sections: Database, API Routes, File Uploads)
- [x] Knowledge Base gotchas for: SQLite timestamps, Multer, Sharp

### Idea Context
- [x] `README.md` - Idea overview
- [x] `planning/brief.md` - Feature brief

---

## Phase 1: Database

### Task 1

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/026_user_profiles.sql"
status: pending

requirements:
  - "Create user_profiles table with profile fields"
  - "Create user_preferences table with settings"
  - "Create linked_accounts table for OAuth"
  - "Add indexes for user_id lookups"
  - "Add foreign keys to users table"

gotchas:
  - "Use TEXT for timestamps, not DATETIME"
  - "Use INTEGER 0/1 for booleans"
  - "Always include IF NOT EXISTS"
  - "UNIQUE constraint on user_id for profiles and preferences"

validation:
  command: "sqlite3 :memory: < database/migrations/026_user_profiles.sql && echo 'OK'"
  expected: "OK"

code_template: |
  -- Migration 026: User Profiles
  -- Created: 2026-01-10
  -- Purpose: User profile, preferences, and linked accounts

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

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 2: Types & Interfaces

### Task 2

```yaml
id: T-002
phase: types
action: CREATE
file: "types/profile.ts"
status: pending

requirements:
  - "Define UserProfile interface"
  - "Define ProfileUpdateInput type"
  - "Define UserPreferences interface"
  - "Define PreferencesUpdateInput type"
  - "Define LinkedAccount interface"
  - "Define PublicProfile interface for public view"

gotchas:
  - "Use string | null for optional fields"
  - "Boolean preferences map to 0/1 in database"
  - "Theme has specific allowed values"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Types for User Profiles
   */

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
    createdAt: string;
  }

  export interface PublicProfile {
    userId: string;
    displayName: string | null;
    bio: string | null;
    avatarPath: string | null;
  }

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 3: Database Queries

### Task 3

```yaml
id: T-003
phase: database
action: UPDATE
file: "database/db.ts"
status: pending

requirements:
  - "Add profile CRUD functions"
  - "Add preferences CRUD functions"
  - "Add getOrCreateProfile for auto-creation"
  - "Add getOrCreatePreferences for auto-creation"

gotchas:
  - "Convert INTEGER to boolean for preferences"
  - "Use generateId() for new records"
  - "Update updated_at on every update"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing file
  import {
    UserProfile, ProfileUpdateInput,
    UserPreferences, PreferencesUpdateInput,
    PublicProfile
  } from '../types/profile.js';

  export function getProfile(userId: string): UserProfile | null {
    const stmt = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?');
    const row = stmt.get(userId) as any;
    if (!row) return null;
    return mapProfileRow(row);
  }

  export function getOrCreateProfile(userId: string): UserProfile {
    let profile = getProfile(userId);
    if (!profile) {
      const id = generateId();
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO user_profiles (id, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(id, userId, now, now);
      profile = getProfile(userId)!;
    }
    return profile;
  }

  export function updateProfile(userId: string, input: ProfileUpdateInput): UserProfile {
    const now = new Date().toISOString();
    const profile = getOrCreateProfile(userId);
    const stmt = db.prepare(`
      UPDATE user_profiles
      SET display_name = ?, bio = ?, location = ?, website = ?, updated_at = ?
      WHERE user_id = ?
    `);
    stmt.run(
      input.displayName ?? profile.displayName,
      input.bio ?? profile.bio,
      input.location ?? profile.location,
      input.website ?? profile.website,
      now,
      userId
    );
    return getProfile(userId)!;
  }

  function mapProfileRow(row: any): UserProfile {
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      location: row.location,
      website: row.website,
      avatarPath: row.avatar_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

depends_on: ["T-001", "T-002"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 4

```yaml
id: T-004
phase: database
action: UPDATE
file: "database/db.ts"
status: pending

requirements:
  - "Add preferences CRUD functions"
  - "Add getOrCreatePreferences function"
  - "Convert boolean values correctly"

gotchas:
  - "SQLite stores booleans as 0/1"
  - "Convert to boolean when reading"
  - "Convert to 0/1 when writing"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing file (continuation)

  export function getPreferences(userId: string): UserPreferences | null {
    const stmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
    const row = stmt.get(userId) as any;
    if (!row) return null;
    return mapPreferencesRow(row);
  }

  export function getOrCreatePreferences(userId: string): UserPreferences {
    let prefs = getPreferences(userId);
    if (!prefs) {
      const id = generateId();
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO user_preferences (id, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(id, userId, now, now);
      prefs = getPreferences(userId)!;
    }
    return prefs;
  }

  export function updatePreferences(userId: string, input: PreferencesUpdateInput): UserPreferences {
    const now = new Date().toISOString();
    const prefs = getOrCreatePreferences(userId);
    const stmt = db.prepare(`
      UPDATE user_preferences
      SET theme = ?, language = ?, timezone = ?,
          email_notifications = ?, push_notifications = ?, weekly_digest = ?,
          updated_at = ?
      WHERE user_id = ?
    `);
    stmt.run(
      input.theme ?? prefs.theme,
      input.language ?? prefs.language,
      input.timezone ?? prefs.timezone,
      input.emailNotifications !== undefined ? (input.emailNotifications ? 1 : 0) : (prefs.emailNotifications ? 1 : 0),
      input.pushNotifications !== undefined ? (input.pushNotifications ? 1 : 0) : (prefs.pushNotifications ? 1 : 0),
      input.weeklyDigest !== undefined ? (input.weeklyDigest ? 1 : 0) : (prefs.weeklyDigest ? 1 : 0),
      now,
      userId
    );
    return getPreferences(userId)!;
  }

  function mapPreferencesRow(row: any): UserPreferences {
    return {
      id: row.id,
      userId: row.user_id,
      theme: row.theme,
      language: row.language,
      timezone: row.timezone,
      emailNotifications: !!row.email_notifications,
      pushNotifications: !!row.push_notifications,
      weeklyDigest: !!row.weekly_digest,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

depends_on: ["T-001", "T-002"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 4: Services

### Task 5

```yaml
id: T-005
phase: services
action: CREATE
file: "server/services/profile-service.ts"
status: pending

requirements:
  - "Wrap database functions with validation"
  - "Add URL validation for website field"
  - "Add length limits for text fields"

gotchas:
  - "Validate URL format if provided"
  - "Bio should have reasonable length limit"
  - "Return null for invalid user IDs"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Profile Service
   * Business logic for user profiles
   */
  import { getOrCreateProfile, updateProfile, getProfile } from '../../database/db.js';
  import { ProfileUpdateInput, UserProfile, PublicProfile } from '../../types/profile.js';

  const MAX_BIO_LENGTH = 500;
  const MAX_DISPLAY_NAME_LENGTH = 100;

  export class ProfileService {
    getProfile(userId: string): UserProfile {
      return getOrCreateProfile(userId);
    }

    getPublicProfile(userId: string): PublicProfile | null {
      const profile = getProfile(userId);
      if (!profile) return null;
      return {
        userId: profile.userId,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarPath: profile.avatarPath
      };
    }

    updateProfile(userId: string, input: ProfileUpdateInput): UserProfile {
      // Validate
      if (input.bio && input.bio.length > MAX_BIO_LENGTH) {
        throw new Error(`Bio must be ${MAX_BIO_LENGTH} characters or less`);
      }
      if (input.displayName && input.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
        throw new Error(`Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or less`);
      }
      if (input.website && !this.isValidUrl(input.website)) {
        throw new Error('Invalid website URL');
      }
      return updateProfile(userId, input);
    }

    private isValidUrl(url: string): boolean {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }
  }

  export const profileService = new ProfileService();

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 6

```yaml
id: T-006
phase: services
action: CREATE
file: "server/services/avatar-handler.ts"
status: pending

requirements:
  - "Handle image upload via multer"
  - "Validate image type by magic bytes"
  - "Resize to 32, 64, 128, 256px using sharp"
  - "Store in assets/avatars/{userId}/"
  - "Delete old avatar when new one uploaded"
  - "Update avatar_path in database"

gotchas:
  - "Create directory if it doesn't exist"
  - "Sharp handles EXIF rotation automatically"
  - "Clean up temp file after processing"
  - "Use synchronous mkdir with recursive option"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Avatar Handler
   * Handles avatar upload, resize, and storage
   */
  import sharp from 'sharp';
  import path from 'path';
  import fs from 'fs';
  import { db } from '../../database/db.js';

  const AVATAR_SIZES = [32, 64, 128, 256];
  const AVATAR_BASE_PATH = 'assets/avatars';
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  export class AvatarHandler {
    async processUpload(userId: string, buffer: Buffer): Promise<{ url: string; sizes: Record<number, string> }> {
      // Validate size
      if (buffer.length > MAX_SIZE_BYTES) {
        throw new Error('Image too large. Maximum size is 5MB.');
      }

      // Validate image type
      const type = await this.getImageType(buffer);
      if (!['jpeg', 'png', 'gif', 'webp'].includes(type)) {
        throw new Error('Invalid image type. Supported: JPEG, PNG, GIF, WebP');
      }

      // Create directory
      const userDir = path.join(AVATAR_BASE_PATH, userId);
      fs.mkdirSync(userDir, { recursive: true });

      // Resize and save
      const sizes: Record<number, string> = {};
      for (const size of AVATAR_SIZES) {
        const filename = `${size}.jpg`;
        const filepath = path.join(userDir, filename);
        await sharp(buffer)
          .resize(size, size, { fit: 'cover' })
          .jpeg({ quality: 85 })
          .toFile(filepath);
        sizes[size] = `/${userDir}/${filename}`;
      }

      // Update database
      const avatarPath = sizes[256];
      const stmt = db.prepare('UPDATE user_profiles SET avatar_path = ? WHERE user_id = ?');
      stmt.run(avatarPath, userId);

      return { url: avatarPath, sizes };
    }

    async deleteAvatar(userId: string): Promise<void> {
      const userDir = path.join(AVATAR_BASE_PATH, userId);
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true });
      }
      const stmt = db.prepare('UPDATE user_profiles SET avatar_path = NULL WHERE user_id = ?');
      stmt.run(userId);
    }

    private async getImageType(buffer: Buffer): Promise<string> {
      const metadata = await sharp(buffer).metadata();
      return metadata.format || 'unknown';
    }
  }

  export const avatarHandler = new AvatarHandler();

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 7

```yaml
id: T-007
phase: services
action: CREATE
file: "server/services/preferences-manager.ts"
status: pending

requirements:
  - "Wrap preferences database functions"
  - "Validate theme values"
  - "Validate timezone format"

gotchas:
  - "Theme must be one of: light, dark, system"
  - "Timezone validation is complex - basic check only"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Preferences Manager
   * Business logic for user preferences
   */
  import { getOrCreatePreferences, updatePreferences } from '../../database/db.js';
  import { UserPreferences, PreferencesUpdateInput } from '../../types/profile.js';

  const VALID_THEMES = ['light', 'dark', 'system'];

  export class PreferencesManager {
    getPreferences(userId: string): UserPreferences {
      return getOrCreatePreferences(userId);
    }

    updatePreferences(userId: string, input: PreferencesUpdateInput): UserPreferences {
      // Validate theme
      if (input.theme && !VALID_THEMES.includes(input.theme)) {
        throw new Error(`Invalid theme. Must be one of: ${VALID_THEMES.join(', ')}`);
      }
      return updatePreferences(userId, input);
    }
  }

  export const preferencesManager = new PreferencesManager();

depends_on: ["T-004"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 5: API Routes

### Task 8

```yaml
id: T-008
phase: api
action: CREATE
file: "server/routes/profile.ts"
status: pending

requirements:
  - "Create GET /api/profile endpoint"
  - "Create PUT /api/profile endpoint"
  - "Create POST /api/profile/avatar endpoint with multer"
  - "Create DELETE /api/profile/avatar endpoint"
  - "Create GET /api/profile/preferences endpoint"
  - "Create PUT /api/profile/preferences endpoint"
  - "Create GET /api/profile/:userId endpoint for public profiles"
  - "All routes except public profile require authentication"

gotchas:
  - "Use multer.memoryStorage() for avatar upload"
  - "Set file size limit in multer config"
  - "Extract userId from req.user"
  - "Return 404 for non-existent public profiles"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Profile Routes
   */
  import { Router } from 'express';
  import multer from 'multer';
  import { profileService } from '../services/profile-service.js';
  import { avatarHandler } from '../services/avatar-handler.js';
  import { preferencesManager } from '../services/preferences-manager.js';
  import { requireAuth } from '../middleware/auth.js';

  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  // GET /api/profile - Get current user's profile
  router.get('/', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const profile = profileService.getProfile(userId);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  // PUT /api/profile - Update profile
  router.put('/', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const profile = profileService.updateProfile(userId, req.body);
      res.json(profile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/profile/avatar - Upload avatar
  router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    try {
      const userId = (req as any).user.id;
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const result = await avatarHandler.processUpload(userId, req.file.buffer);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE /api/profile/avatar - Remove avatar
  router.delete('/avatar', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      await avatarHandler.deleteAvatar(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete avatar' });
    }
  });

  // GET /api/profile/preferences - Get preferences
  router.get('/preferences', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const preferences = preferencesManager.getPreferences(userId);
      res.json(preferences);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get preferences' });
    }
  });

  // PUT /api/profile/preferences - Update preferences
  router.put('/preferences', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const preferences = preferencesManager.updatePreferences(userId, req.body);
      res.json(preferences);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET /api/profile/:userId - Get public profile
  router.get('/:userId', async (req, res) => {
    try {
      const profile = profileService.getPublicProfile(req.params.userId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  export default router;

depends_on: ["T-005", "T-006", "T-007"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 9

```yaml
id: T-009
phase: api
action: UPDATE
file: "server/api.ts"
status: pending

requirements:
  - "Import profile router"
  - "Mount at /api/profile"
  - "Add static file serving for avatars"

gotchas:
  - "Mount avatar static route before profile routes"
  - "Use express.static for assets directory"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add imports at top
  import profileRouter from './routes/profile.js';
  import express from 'express';

  // Add static file serving for avatars (before routes)
  app.use('/assets', express.static('assets'));

  // Mount profile routes
  app.use('/api/profile', profileRouter);

depends_on: ["T-008"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 6: Tests

### Task 10

```yaml
id: T-010
phase: tests
action: CREATE
file: "tests/profile.test.ts"
status: pending

requirements:
  - "Test profile CRUD operations"
  - "Test auto-creation of profile"
  - "Test validation (bio length, URL format)"

gotchas:
  - "Use test database"
  - "Clean up after tests"
  - "Mock authentication for route tests"

validation:
  command: "npm test -- --grep 'profile'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { profileService } from '../server/services/profile-service.js';

  describe('Profile Service', () => {
    const testUserId = 'test-user-' + Date.now();

    it('should auto-create profile on first access', () => {
      const profile = profileService.getProfile(testUserId);
      expect(profile).toBeDefined();
      expect(profile.userId).toBe(testUserId);
    });

    it('should update profile fields', () => {
      const profile = profileService.updateProfile(testUserId, {
        displayName: 'Test User',
        bio: 'A test bio'
      });
      expect(profile.displayName).toBe('Test User');
      expect(profile.bio).toBe('A test bio');
    });

    it('should reject invalid website URL', () => {
      expect(() => {
        profileService.updateProfile(testUserId, {
          website: 'not-a-url'
        });
      }).toThrow('Invalid website URL');
    });

    it('should reject bio over 500 characters', () => {
      expect(() => {
        profileService.updateProfile(testUserId, {
          bio: 'x'.repeat(501)
        });
      }).toThrow('Bio must be 500 characters or less');
    });
  });

depends_on: ["T-005"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 11

```yaml
id: T-011
phase: tests
action: CREATE
file: "tests/avatar.test.ts"
status: pending

requirements:
  - "Test avatar upload with valid image"
  - "Test rejection of oversized images"
  - "Test rejection of invalid file types"
  - "Test avatar deletion"

gotchas:
  - "Need to create test image buffer"
  - "Clean up test avatar directory"
  - "Mock sharp for unit tests"

validation:
  command: "npm test -- --grep 'avatar'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { avatarHandler } from '../server/services/avatar-handler.js';
  import fs from 'fs';
  import path from 'path';

  describe('Avatar Handler', () => {
    const testUserId = 'avatar-test-' + Date.now();
    const testAvatarDir = path.join('assets/avatars', testUserId);

    afterEach(() => {
      if (fs.existsSync(testAvatarDir)) {
        fs.rmSync(testAvatarDir, { recursive: true });
      }
    });

    it('should reject oversized images', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      await expect(avatarHandler.processUpload(testUserId, largeBuffer))
        .rejects.toThrow('Image too large');
    });

    it('should delete avatar and clean up files', async () => {
      // First create directory
      fs.mkdirSync(testAvatarDir, { recursive: true });
      fs.writeFileSync(path.join(testAvatarDir, '256.jpg'), 'test');

      await avatarHandler.deleteAvatar(testUserId);

      expect(fs.existsSync(testAvatarDir)).toBe(false);
    });
  });

depends_on: ["T-006"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 12

```yaml
id: T-012
phase: tests
action: CREATE
file: "tests/preferences.test.ts"
status: pending

requirements:
  - "Test preferences auto-creation"
  - "Test preferences update"
  - "Test theme validation"
  - "Test boolean conversion"

gotchas:
  - "Verify booleans are properly converted from 0/1"
  - "Test default values"

validation:
  command: "npm test -- --grep 'preferences'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect } from 'vitest';
  import { preferencesManager } from '../server/services/preferences-manager.js';

  describe('Preferences Manager', () => {
    const testUserId = 'pref-test-' + Date.now();

    it('should auto-create preferences with defaults', () => {
      const prefs = preferencesManager.getPreferences(testUserId);
      expect(prefs).toBeDefined();
      expect(prefs.theme).toBe('system');
      expect(prefs.language).toBe('en');
      expect(prefs.emailNotifications).toBe(true);
    });

    it('should update preferences', () => {
      const prefs = preferencesManager.updatePreferences(testUserId, {
        theme: 'dark',
        emailNotifications: false
      });
      expect(prefs.theme).toBe('dark');
      expect(prefs.emailNotifications).toBe(false);
    });

    it('should reject invalid theme', () => {
      expect(() => {
        preferencesManager.updatePreferences(testUserId, {
          theme: 'invalid' as any
        });
      }).toThrow('Invalid theme');
    });
  });

depends_on: ["T-007"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Execution Log

| Task | Status | Started | Completed | Duration | Notes |
|------|--------|---------|-----------|----------|-------|
| | | | | | |

---

## Discoveries

### Patterns Discovered

| Pattern | Context | Confidence |
|---------|---------|------------|
| | | |

### Gotchas Discovered

| Gotcha | Context | Should Propagate? |
|--------|---------|-------------------|
| | | |

---

## Validation Results

### TypeScript Check

```
[output of npx tsc --noEmit]
```

### Test Results

```
[output of npm test]
```

---

## Completion Checklist

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] No TypeScript errors
- [ ] Tests passing
- [ ] Discoveries recorded in Knowledge Base
- [ ] Execution log updated

---

## Sign-off

**Completed By:**
**Completed At:**
**Final Status:**
**Commits:**

---

*Generated for Spec Agent reference*
*Executed by Build Agent*
