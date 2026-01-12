/**
 * Preferences Manager
 * Business logic for user preferences
 */
import { getOrCreatePreferences, updateUserPreferences } from '../../database/db.js';
import { UserPreferences, PreferencesUpdateInput } from '../../types/profile.js';

const VALID_THEMES = ['light', 'dark', 'system'];

export class PreferencesManager {
  getPreferences(userId: string): Promise<UserPreferences> {
    return getOrCreatePreferences(userId);
  }

  async updatePreferences(userId: string, input: PreferencesUpdateInput): Promise<UserPreferences> {
    // Validate theme
    if (input.theme && !VALID_THEMES.includes(input.theme)) {
      throw new Error(`Invalid theme. Must be one of: ${VALID_THEMES.join(', ')}`);
    }
    return updateUserPreferences(userId, input);
  }
}

export const preferencesManager = new PreferencesManager();
