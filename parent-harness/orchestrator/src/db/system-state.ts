import { getOne, run } from './index.js';

interface SystemStateRow {
  value: string;
}

export function getSystemFlag(key: string): string | null {
  const row = getOne<SystemStateRow>(
    'SELECT value FROM system_state WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export function isSystemFlagEnabled(key: string): boolean {
  return getSystemFlag(key) === 'true';
}

export function setSystemFlag(key: string, value: string): void {
  run(
    `INSERT OR REPLACE INTO system_state (key, value, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [key, value]
  );
}

export function clearSystemFlag(key: string): void {
  run('DELETE FROM system_state WHERE key = ?', [key]);
}

export default {
  getSystemFlag,
  isSystemFlagEnabled,
  setSystemFlag,
  clearSystemFlag,
};

