/**
 * Avatar Handler Tests
 */

import { describe, it, expect, afterEach } from "vitest";
import { avatarHandler } from "../server/services/avatar-handler.js";
import fs from "fs";
import path from "path";

describe("Avatar Handler", () => {
  const testUserId = "avatar-test-" + Date.now();
  const testAvatarDir = path.join("assets/avatars", testUserId);

  afterEach(() => {
    if (fs.existsSync(testAvatarDir)) {
      fs.rmSync(testAvatarDir, { recursive: true });
    }
  });

  it("should reject oversized images", async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    await expect(
      avatarHandler.processUpload(testUserId, largeBuffer),
    ).rejects.toThrow("Image too large");
  });

  it("should reject invalid image data", async () => {
    const invalidBuffer = Buffer.from("not an image");
    await expect(
      avatarHandler.processUpload(testUserId, invalidBuffer),
    ).rejects.toThrow();
  });

  it("should delete avatar and clean up files", async () => {
    // First create directory
    fs.mkdirSync(testAvatarDir, { recursive: true });
    fs.writeFileSync(path.join(testAvatarDir, "256.jpg"), "test");

    await avatarHandler.deleteAvatar(testUserId);

    expect(fs.existsSync(testAvatarDir)).toBe(false);
  });

  it("should not throw when deleting non-existent avatar", async () => {
    await expect(
      avatarHandler.deleteAvatar("non-existent-user"),
    ).resolves.not.toThrow();
  });
});
