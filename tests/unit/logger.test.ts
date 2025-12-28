import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setLogLevel,
  logDebug,
  logInfo,
  logWarning,
  logError,
  getLoggerConfig
} from '../../utils/logger.js';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setLogLevel('debug'); // Reset to most verbose
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should log debug messages when level is debug', () => {
    setLogLevel('debug');
    logDebug('test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should not log debug messages when level is info', () => {
    setLogLevel('info');
    logDebug('test message');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log info messages when level is info', () => {
    setLogLevel('info');
    logInfo('test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should log warnings when level is warn', () => {
    setLogLevel('warn');
    logWarning('test warning');
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('should log errors when level is error', () => {
    setLogLevel('error');
    logError('test error');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should not log info when level is error', () => {
    setLogLevel('error');
    logInfo('test message');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should include context in debug logs', () => {
    setLogLevel('debug');
    logDebug('test', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs.some(arg => typeof arg === 'string' && arg.includes('value'))).toBe(true);
  });
});
