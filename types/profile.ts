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
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PreferencesUpdateInput {
  theme?: "light" | "dark" | "system";
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
