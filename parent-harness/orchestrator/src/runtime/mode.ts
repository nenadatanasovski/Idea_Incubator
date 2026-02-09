export type RuntimeMode = 'event' | 'legacy';

const VALID_MODES: RuntimeMode[] = ['event', 'legacy'];

/**
 * Resolve runtime mode from HARNESS_EVENT_SYSTEM or HARNESS_RUNTIME_MODE.
 * HARNESS_RUNTIME_MODE takes precedence when set.
 */
export function getRuntimeMode(): RuntimeMode {
  const explicit = (process.env.HARNESS_RUNTIME_MODE || '').trim().toLowerCase();
  if (explicit) {
    if (VALID_MODES.includes(explicit as RuntimeMode)) {
      return explicit as RuntimeMode;
    }
    throw new Error(
      `Invalid HARNESS_RUNTIME_MODE="${process.env.HARNESS_RUNTIME_MODE}". Expected one of: ${VALID_MODES.join(', ')}`
    );
  }

  const eventFlag = (process.env.HARNESS_EVENT_SYSTEM || '').trim().toLowerCase();
  if (!eventFlag) {
    return 'legacy';
  }
  if (eventFlag === 'true') {
    return 'event';
  }
  if (eventFlag === 'false') {
    return 'legacy';
  }

  throw new Error(
    `Invalid HARNESS_EVENT_SYSTEM="${process.env.HARNESS_EVENT_SYSTEM}". Expected true/false when provided.`
  );
}

export function isEventMode(mode: RuntimeMode = getRuntimeMode()): boolean {
  return mode === 'event';
}

export function isLegacyMode(mode: RuntimeMode = getRuntimeMode()): boolean {
  return mode === 'legacy';
}

