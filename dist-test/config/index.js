import { config as defaultConfig } from './default.js';
import { ConfigurationError } from '../utils/errors.js';
let currentConfig = { ...defaultConfig };
/**
 * Get current configuration
 */
export function getConfig() {
    return currentConfig;
}
/**
 * Update configuration with partial values
 */
export function updateConfig(updates) {
    currentConfig = deepMerge(currentConfig, updates);
    return currentConfig;
}
/**
 * Reset to default configuration
 */
export function resetConfig() {
    currentConfig = { ...defaultConfig };
    return currentConfig;
}
/**
 * Validate configuration
 */
export function validateConfig(config) {
    // Validate budget
    if (config.budget.default <= 0) {
        throw new ConfigurationError('budget.default', 'must be positive');
    }
    if (config.budget.max < config.budget.default) {
        throw new ConfigurationError('budget.max', 'must be greater than or equal to default');
    }
    // Validate debate settings
    if (config.debate.challengesPerCriterion < 1) {
        throw new ConfigurationError('debate.challengesPerCriterion', 'must be at least 1');
    }
    if (config.debate.roundsPerChallenge < 1) {
        throw new ConfigurationError('debate.roundsPerChallenge', 'must be at least 1');
    }
    if (config.debate.maxRounds < 1) {
        throw new ConfigurationError('debate.maxRounds', 'must be at least 1');
    }
    // Validate weights sum to 1.0
    const weightSum = Object.values(config.categoryWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
        throw new ConfigurationError('categoryWeights', `must sum to 1.0, got ${weightSum}`);
    }
}
/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
    const output = { ...target };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (sourceValue !== undefined &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)) {
            output[key] = deepMerge(targetValue, sourceValue);
        }
        else if (sourceValue !== undefined) {
            output[key] = sourceValue;
        }
    }
    return output;
}
export { defaultConfig };
