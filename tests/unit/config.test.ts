import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig, updateConfig, resetConfig, validateConfig } from '../../config/index.js';
import { ConfigurationError } from '../../utils/errors.js';

describe('Config', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('should return default config', () => {
    const config = getConfig();
    expect(config.model).toBe('claude-opus-4-5-20251101');
    expect(config.budget.default).toBe(15.00); // Updated from $10 to $15 per Q10
  });

  it('should update config with partial values', () => {
    const updated = updateConfig({
      budget: { default: 20.00, max: 50.00 }
    });

    expect(updated.budget.default).toBe(20.00);
    expect(updated.model).toBe('claude-opus-4-5-20251101'); // unchanged
  });

  it('should reset config to defaults', () => {
    updateConfig({ budget: { default: 20.00, max: 50.00 } });
    const reset = resetConfig();

    expect(reset.budget.default).toBe(15.00); // Updated from $10 to $15 per Q10
  });

  it('should validate config - pass', () => {
    const config = getConfig();
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('should validate config - fail on negative budget', () => {
    const config = getConfig();
    const badConfig = { ...config, budget: { default: -5, max: 50 } };

    expect(() => validateConfig(badConfig)).toThrow(ConfigurationError);
  });

  it('should validate config - fail on max < default', () => {
    const config = getConfig();
    const badConfig = { ...config, budget: { default: 20, max: 10 } };

    expect(() => validateConfig(badConfig)).toThrow(ConfigurationError);
  });

  it('should validate config - fail on weights not summing to 1', () => {
    const config = getConfig();
    const badConfig = {
      ...config,
      categoryWeights: {
        problem: 0.5,
        solution: 0.5,
        feasibility: 0.5,
        fit: 0.5,
        market: 0.5,
        risk: 0.5
      }
    };

    expect(() => validateConfig(badConfig)).toThrow(ConfigurationError);
  });
});
