/**
 * Profile Service Tests
 */

import { describe, it, expect } from "vitest";
import { profileService } from "../server/services/profile-service.js";

describe("Profile Service", () => {
  const testUserId = "test-user-" + Date.now();

  it("should auto-create profile on first access", async () => {
    const profile = await profileService.getProfile(testUserId);
    expect(profile).toBeDefined();
    expect(profile.userId).toBe(testUserId);
  });

  it("should return same profile on subsequent access", async () => {
    const profile1 = await profileService.getProfile(testUserId);
    const profile2 = await profileService.getProfile(testUserId);
    expect(profile1.id).toBe(profile2.id);
  });

  it("should update profile fields", async () => {
    const profile = await profileService.updateProfile(testUserId, {
      displayName: "Test User",
      bio: "A test bio",
    });
    expect(profile.displayName).toBe("Test User");
    expect(profile.bio).toBe("A test bio");
  });

  it("should accept valid website URL", async () => {
    const profile = await profileService.updateProfile(testUserId, {
      website: "https://example.com",
    });
    expect(profile.website).toBe("https://example.com");
  });

  it("should reject invalid website URL", async () => {
    await expect(
      profileService.updateProfile(testUserId, {
        website: "not-a-url",
      }),
    ).rejects.toThrow("Invalid website URL");
  });

  it("should reject bio over 500 characters", async () => {
    await expect(
      profileService.updateProfile(testUserId, {
        bio: "x".repeat(501),
      }),
    ).rejects.toThrow("Bio must be 500 characters or less");
  });

  it("should reject display name over 100 characters", async () => {
    await expect(
      profileService.updateProfile(testUserId, {
        displayName: "x".repeat(101),
      }),
    ).rejects.toThrow("Display name must be 100 characters or less");
  });

  it("should get public profile", async () => {
    // First ensure profile exists
    await profileService.updateProfile(testUserId, {
      displayName: "Public Test",
      bio: "Public bio",
    });

    const publicProfile = await profileService.getPublicProfile(testUserId);
    expect(publicProfile).toBeDefined();
    expect(publicProfile!.displayName).toBe("Public Test");
    expect(publicProfile!.bio).toBe("Public bio");
    // Public profile should not include userId internal field
    expect(publicProfile).not.toHaveProperty("id");
    expect(publicProfile).not.toHaveProperty("createdAt");
  });

  it("should return null for non-existent public profile", async () => {
    const publicProfile =
      await profileService.getPublicProfile("non-existent-user");
    expect(publicProfile).toBeNull();
  });
});
