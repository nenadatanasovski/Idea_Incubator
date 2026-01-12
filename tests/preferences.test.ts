/**
 * Preferences Manager Tests
 */

import { describe, it, expect } from 'vitest';
import { preferencesManager } from '../server/services/preferences-manager.js';

describe('Preferences Manager', () => {
  const testUserId = 'pref-test-' + Date.now();

  it('should auto-create preferences with defaults', async () => {
    const prefs = await preferencesManager.getPreferences(testUserId);
    expect(prefs).toBeDefined();
    expect(prefs.theme).toBe('system');
    expect(prefs.language).toBe('en');
    expect(prefs.timezone).toBe('UTC');
    expect(prefs.emailNotifications).toBe(true);
    expect(prefs.pushNotifications).toBe(true);
    expect(prefs.weeklyDigest).toBe(true);
  });

  it('should return same preferences on subsequent access', async () => {
    const prefs1 = await preferencesManager.getPreferences(testUserId);
    const prefs2 = await preferencesManager.getPreferences(testUserId);
    expect(prefs1.id).toBe(prefs2.id);
  });

  it('should update theme', async () => {
    const prefs = await preferencesManager.updatePreferences(testUserId, {
      theme: 'dark'
    });
    expect(prefs.theme).toBe('dark');
  });

  it('should update language', async () => {
    const prefs = await preferencesManager.updatePreferences(testUserId, {
      language: 'es'
    });
    expect(prefs.language).toBe('es');
  });

  it('should update notification preferences', async () => {
    const prefs = await preferencesManager.updatePreferences(testUserId, {
      emailNotifications: false,
      pushNotifications: false,
      weeklyDigest: false
    });
    expect(prefs.emailNotifications).toBe(false);
    expect(prefs.pushNotifications).toBe(false);
    expect(prefs.weeklyDigest).toBe(false);
  });

  it('should reject invalid theme', async () => {
    await expect(
      preferencesManager.updatePreferences(testUserId, {
        theme: 'invalid' as any
      })
    ).rejects.toThrow('Invalid theme');
  });

  it('should accept valid themes', async () => {
    for (const theme of ['light', 'dark', 'system'] as const) {
      const prefs = await preferencesManager.updatePreferences(testUserId, { theme });
      expect(prefs.theme).toBe(theme);
    }
  });

  it('should preserve unchanged fields', async () => {
    // Set initial values
    await preferencesManager.updatePreferences(testUserId, {
      theme: 'light',
      language: 'fr'
    });

    // Update only theme
    const prefs = await preferencesManager.updatePreferences(testUserId, {
      theme: 'dark'
    });

    // Language should be preserved
    expect(prefs.language).toBe('fr');
  });
});
