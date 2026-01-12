/**
 * Avatar Handler
 * Handles avatar upload, resize, and storage
 */
import path from 'path';
import fs from 'fs';
import { updateAvatarPath, getOrCreateProfile } from '../../database/db.js';

const AVATAR_SIZES = [32, 64, 128, 256];
const AVATAR_BASE_PATH = 'assets/avatars';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export class AvatarHandler {
  async processUpload(userId: string, buffer: Buffer): Promise<{ url: string; sizes: Record<number, string> }> {
    // Validate size
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new Error('Image too large. Maximum size is 5MB.');
    }

    // Ensure profile exists
    await getOrCreateProfile(userId);

    // Lazy load sharp
    const sharp = (await import('sharp')).default;

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
    await updateAvatarPath(userId, avatarPath);

    return { url: avatarPath, sizes };
  }

  async deleteAvatar(userId: string): Promise<void> {
    const userDir = path.join(AVATAR_BASE_PATH, userId);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true });
    }
    await updateAvatarPath(userId, null);
  }

  private async getImageType(buffer: Buffer): Promise<string> {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer).metadata();
    return metadata.format || 'unknown';
  }
}

export const avatarHandler = new AvatarHandler();
