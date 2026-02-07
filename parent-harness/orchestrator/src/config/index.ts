/**
 * Harness Configuration System
 * 
 * Provides centralized, file-based configuration with:
 * - Default values
 * - Hot-reload on file change
 * - API access for dashboard
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.harness');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Configuration schema
 */
export interface HarnessConfig {
  planning: {
    interval_hours: number;      // How often to run planning (default: 24)
    model: string;               // Model for planning agents (default: haiku)
    timeout_minutes: number;     // Planning timeout (default: 15)
    enabled: boolean;            // Enable planning (default: true)
  };
  agents: {
    model: string;               // Model for build agents (default: opus)
    model_fallback: string[];    // Fallback chain when rate limited (default: ['opus', 'sonnet', 'haiku'])
    timeout_minutes: number;     // Agent timeout (default: 5)
    max_concurrent: number;      // Max parallel agents (default: 8)
    max_output_tokens: number;   // Max output tokens per agent (default: 16000)
    enabled: boolean;            // Enable agent spawning (default: true)
  };
  budget: {
    daily_token_limit: number;   // Daily token budget (default: 500000)
    warn_thresholds: number[];   // Warning percentages (default: [50, 80, 100])
    pause_at_limit: boolean;     // Stop spawning at limit (default: false)
    notify_telegram: boolean;    // Send Telegram notifications (default: true)
    p0_reserve_percent: number;  // Reserve budget % for P0 tasks (default: 20)
  };
  cleanup: {
    retention_days: number;      // Days to keep session data (default: 7)
    auto_cleanup: boolean;       // Run cleanup on startup (default: true)
  };
  qa: {
    enabled: boolean;            // Enable QA cycles (default: true)
    every_n_ticks: number;       // Run QA every N ticks (default: 10)
  };
  retry: {
    max_attempts: number;        // Max retry attempts per task (default: 5)
    backoff_base_ms: number;     // Base backoff delay (default: 30000)
    backoff_multiplier: number;  // Backoff multiplier (default: 2)
    max_backoff_ms: number;      // Max backoff delay (default: 3600000 = 1h)
  };
  circuit_breaker: {
    enabled: boolean;            // Enable circuit breaker (default: true)
    failure_threshold: number;   // Failures before opening circuit (default: 5)
    window_minutes: number;      // Failure window (default: 30)
    cooldown_minutes: number;    // Cooldown before retry (default: 60)
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: HarnessConfig = {
  planning: {
    interval_hours: 24,
    model: 'haiku',
    timeout_minutes: 15,
    enabled: true,
  },
  agents: {
    model: 'opus',
    model_fallback: ['opus', 'sonnet', 'haiku'],
    timeout_minutes: 5,
    max_concurrent: 2,  // Reduced from 8 to prevent resource exhaustion
    max_output_tokens: 16000,
    enabled: true,
  },
  budget: {
    daily_token_limit: 500000,
    warn_thresholds: [50, 80, 100],
    pause_at_limit: false,
    notify_telegram: true,
    p0_reserve_percent: 20,
  },
  cleanup: {
    retention_days: 7,
    auto_cleanup: true,
  },
  qa: {
    enabled: true,
    every_n_ticks: 10,
  },
  retry: {
    max_attempts: 5,
    backoff_base_ms: 30000,
    backoff_multiplier: 2,
    max_backoff_ms: 3600000,
  },
  circuit_breaker: {
    enabled: true,
    failure_threshold: 5,
    window_minutes: 30,
    cooldown_minutes: 60,
  },
};

// Current config in memory
let currentConfig: HarnessConfig = { ...DEFAULT_CONFIG };
let configLoaded = false;

// Callbacks for config changes
const changeListeners: Array<(config: HarnessConfig) => void> = [];

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    console.log(`📁 Created config directory: ${CONFIG_DIR}`);
  }
}

/**
 * Deep merge objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
        result[key] = deepMerge(result[key] as Record<string, any>, source[key] as Record<string, any>) as T[typeof key];
      } else {
        result[key] = source[key] as T[typeof key];
      }
    }
  }
  return result;
}

/**
 * Load configuration from file
 */
export function loadConfig(): HarnessConfig {
  ensureConfigDir();
  
  if (!existsSync(CONFIG_FILE)) {
    // Create default config file
    saveConfig(DEFAULT_CONFIG);
    currentConfig = { ...DEFAULT_CONFIG };
    configLoaded = true;
    console.log(`📝 Created default config at ${CONFIG_FILE}`);
    return currentConfig;
  }
  
  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8');
    const loaded = JSON.parse(data);
    
    // Merge with defaults to ensure all fields exist
    currentConfig = deepMerge(DEFAULT_CONFIG, loaded);
    configLoaded = true;
    
    console.log(`✅ Loaded config from ${CONFIG_FILE}`);
    return currentConfig;
  } catch (err) {
    console.error('⚠️ Failed to load config, using defaults:', err);
    currentConfig = { ...DEFAULT_CONFIG };
    configLoaded = true;
    return currentConfig;
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: HarnessConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  currentConfig = config;
  console.log(`💾 Saved config to ${CONFIG_FILE}`);
  
  // Notify listeners
  for (const listener of changeListeners) {
    try {
      listener(config);
    } catch (err) {
      console.error('Config change listener error:', err);
    }
  }
}

/**
 * Get current configuration
 */
export function getConfig(): HarnessConfig {
  if (!configLoaded) {
    loadConfig();
  }
  return currentConfig;
}

/**
 * Update specific config values (partial update)
 */
export function updateConfig(updates: Partial<HarnessConfig>): HarnessConfig {
  const newConfig = deepMerge(getConfig(), updates);
  saveConfig(newConfig);
  return newConfig;
}

/**
 * Reset to default configuration
 */
export function resetConfig(): HarnessConfig {
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

/**
 * Register a listener for config changes
 */
export function onConfigChange(listener: (config: HarnessConfig) => void): void {
  changeListeners.push(listener);
}

/**
 * Start watching config file for external changes
 */
export function watchConfig(): void {
  ensureConfigDir();
  
  if (existsSync(CONFIG_FILE)) {
    watch(CONFIG_FILE, (eventType) => {
      if (eventType === 'change') {
        console.log('📂 Config file changed, reloading...');
        loadConfig();
        
        // Notify listeners
        for (const listener of changeListeners) {
          try {
            listener(currentConfig);
          } catch (err) {
            console.error('Config change listener error:', err);
          }
        }
      }
    });
    console.log(`👁️ Watching config file for changes: ${CONFIG_FILE}`);
  }
}

/**
 * Get config file path (for debugging)
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Validate config values
 */
export function validateConfig(config: Partial<HarnessConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.planning?.interval_hours !== undefined) {
    if (config.planning.interval_hours < 1 || config.planning.interval_hours > 168) {
      errors.push('planning.interval_hours must be between 1 and 168');
    }
  }
  
  if (config.agents?.max_concurrent !== undefined) {
    if (config.agents.max_concurrent < 1 || config.agents.max_concurrent > 20) {
      errors.push('agents.max_concurrent must be between 1 and 20');
    }
  }
  
  if (config.budget?.daily_token_limit !== undefined) {
    if (config.budget.daily_token_limit < 10000) {
      errors.push('budget.daily_token_limit must be at least 10000');
    }
  }
  
  if (config.cleanup?.retention_days !== undefined) {
    if (config.cleanup.retention_days < 1 || config.cleanup.retention_days > 30) {
      errors.push('cleanup.retention_days must be between 1 and 30');
    }
  }

  if (config.agents?.max_output_tokens !== undefined) {
    if (config.agents.max_output_tokens < 1000 || config.agents.max_output_tokens > 100000) {
      errors.push('agents.max_output_tokens must be between 1000 and 100000');
    }
  }

  if (config.budget?.p0_reserve_percent !== undefined) {
    if (config.budget.p0_reserve_percent < 0 || config.budget.p0_reserve_percent > 50) {
      errors.push('budget.p0_reserve_percent must be between 0 and 50');
    }
  }

  if (config.retry?.max_attempts !== undefined) {
    if (config.retry.max_attempts < 1 || config.retry.max_attempts > 20) {
      errors.push('retry.max_attempts must be between 1 and 20');
    }
  }

  if (config.circuit_breaker?.failure_threshold !== undefined) {
    if (config.circuit_breaker.failure_threshold < 1 || config.circuit_breaker.failure_threshold > 20) {
      errors.push('circuit_breaker.failure_threshold must be between 1 and 20');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export default {
  loadConfig,
  saveConfig,
  getConfig,
  updateConfig,
  resetConfig,
  onConfigChange,
  watchConfig,
  getConfigPath,
  validateConfig,
  DEFAULT_CONFIG,
};
