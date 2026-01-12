/**
 * User Profile Routes (authenticated users)
 * Routes for profile, avatar, and preferences management
 */
import { Router, Request } from 'express';
import multer from 'multer';
import { profileService } from '../services/profile-service.js';
import { avatarHandler } from '../services/avatar-handler.js';
import { preferencesManager } from '../services/preferences-manager.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function getUserId(req: Request): string {
  return (req as Request & { user?: { id: string } }).user?.id
    || req.headers['x-user-id'] as string
    || 'anonymous';
}

router.get('/', async (req, res) => {
  try {
    return res.json(await profileService.getProfile(getUserId(req)));
  } catch (error) {
    console.error('Error getting profile:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.put('/', async (req, res) => {
  try {
    return res.json(await profileService.updateProfile(getUserId(req), req.body));
  } catch (error: unknown) {
    console.error('Error updating profile:', error);
    return res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    return res.json(await avatarHandler.processUpload(getUserId(req), req.file.buffer));
  } catch (error: unknown) {
    console.error('Error uploading avatar:', error);
    return res.status(400).json({ error: (error as Error).message });
  }
});

router.delete('/avatar', async (req, res) => {
  try {
    await avatarHandler.deleteAvatar(getUserId(req));
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

router.get('/preferences', async (req, res) => {
  try {
    return res.json(await preferencesManager.getPreferences(getUserId(req)));
  } catch (error) {
    console.error('Error getting preferences:', error);
    return res.status(500).json({ error: 'Failed to get preferences' });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    return res.json(await preferencesManager.updatePreferences(getUserId(req), req.body));
  } catch (error: unknown) {
    console.error('Error updating preferences:', error);
    return res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const profile = await profileService.getPublicProfile(req.params.userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.json(profile);
  } catch (error) {
    console.error('Error getting public profile:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
});

export default router;
