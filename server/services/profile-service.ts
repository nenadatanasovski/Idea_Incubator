/**
 * Profile Service
 * Business logic for user profiles
 */
import { getOrCreateProfile, updateUserProfile, getPublicProfile as dbGetPublicProfile } from '../../database/db.js';
import { ProfileUpdateInput, UserProfile, PublicProfile } from '../../types/profile.js';

const MAX_BIO_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 100;

export class ProfileService {
  getProfile(userId: string): Promise<UserProfile> {
    return getOrCreateProfile(userId);
  }

  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    return dbGetPublicProfile(userId);
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<UserProfile> {
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
    return updateUserProfile(userId, input);
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
