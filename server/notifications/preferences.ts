/**
 * Notification Preferences
 * Manages user channel preferences with caching for performance
 */
import {
  getEffectiveChannels,
  setUserChannelPrefs,
  getAllUserChannelPrefs
} from '../../database/db.js';
import {
  NotificationChannel,
  ChannelPreference
} from '../../types/notification.js';

/**
 * NotificationPreferences provides a cached layer over the database
 * for quick channel preference lookups
 */
class NotificationPreferences {
  // Cache: userId:type -> channels[]
  private cache = new Map<string, NotificationChannel[]>();

  // Cache TTL in milliseconds (5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000;

  // Track when each cache entry was created
  private cacheTimestamps = new Map<string, number>();

  /**
   * Generate cache key from userId and notification type
   */
  private getCacheKey(userId: string, type: string): string {
    return `${userId}:${type}`;
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  /**
   * Get effective channels for a user and notification type
   * Uses cache for performance, falls back to database
   */
  async getChannels(userId: string, type: string): Promise<NotificationChannel[]> {
    const cacheKey = this.getCacheKey(userId, type);

    // Check cache first
    if (this.cache.has(cacheKey) && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Fetch from database
    const channels = await getEffectiveChannels(userId, type);

    // Update cache
    this.cache.set(cacheKey, channels);
    this.cacheTimestamps.set(cacheKey, Date.now());

    return channels;
  }

  /**
   * Set user's channel preference for a notification type
   * Invalidates the cache for this user/type combination
   */
  async setPreference(
    userId: string,
    type: string,
    channels: NotificationChannel[],
    mutedUntil?: string
  ): Promise<ChannelPreference> {
    // Update database
    const pref = await setUserChannelPrefs(userId, type, channels, mutedUntil);

    // Invalidate cache for this entry
    const cacheKey = this.getCacheKey(userId, type);
    this.cache.delete(cacheKey);
    this.cacheTimestamps.delete(cacheKey);

    return pref;
  }

  /**
   * Get all preferences for a user
   * Does not use cache (used for settings page, not hot path)
   */
  async getAllPreferences(userId: string): Promise<ChannelPreference[]> {
    return getAllUserChannelPrefs(userId);
  }

  /**
   * Mute a notification type for a user
   * @param duration - Duration to mute in milliseconds
   */
  async mute(userId: string, type: string, duration: number): Promise<ChannelPreference> {
    const mutedUntil = new Date(Date.now() + duration).toISOString();
    const existing = await getEffectiveChannels(userId, type);
    return this.setPreference(userId, type, existing, mutedUntil);
  }

  /**
   * Unmute a notification type for a user
   */
  async unmute(userId: string, type: string): Promise<ChannelPreference> {
    const existing = await getEffectiveChannels(userId, type);
    return this.setPreference(userId, type, existing, undefined);
  }

  /**
   * Clear cache for a specific user
   * Call when user logs out or settings are bulk-updated
   */
  clearCacheForUser(userId: string): void {
    const prefix = `${userId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   * Call on server restart or major settings changes
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to track hits/misses to calculate
    };
  }
}

// Singleton instance
export const notificationPreferences = new NotificationPreferences();
