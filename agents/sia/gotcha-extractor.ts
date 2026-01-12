// agents/sia/gotcha-extractor.ts - Extract gotchas from execution failures

import { ExtractedGotcha, FailureInfo } from '../../types/sia.js';
import {
  matchExtractionRule,
  inferFilePattern,
  inferActionType,
} from './extraction-rules.js';

/**
 * Extract gotchas from a list of task failures
 */
export function extractGotchas(failures: FailureInfo[]): ExtractedGotcha[] {
  const gotchas: ExtractedGotcha[] = [];

  for (const failure of failures) {
    const gotcha = extractGotchaFromFailure(failure);
    if (gotcha) {
      gotchas.push(gotcha);
    }
  }

  return deduplicateGotchas(gotchas);
}

/**
 * Extract a single gotcha from a failure
 */
export function extractGotchaFromFailure(failure: FailureInfo): ExtractedGotcha | null {
  // Try to match against predefined rules
  const matchedRule = matchExtractionRule(failure.errorMessage, failure.file);

  if (matchedRule) {
    return {
      errorType: categorizeError(failure.errorMessage),
      errorMessage: truncateMessage(failure.errorMessage),
      fix: matchedRule.fix,
      filePattern: matchedRule.filePattern,
      actionType: inferActionType(failure.action),
      taskId: failure.taskId,
    };
  }

  // If a fix was applied, we can extract a gotcha from that
  if (failure.fixApplied) {
    return {
      errorType: categorizeError(failure.errorMessage),
      errorMessage: truncateMessage(failure.errorMessage),
      fix: failure.fixApplied,
      filePattern: inferFilePattern(failure.file),
      actionType: inferActionType(failure.action),
      taskId: failure.taskId,
    };
  }

  return null;
}

/**
 * Categorize an error message into a type
 */
export function categorizeError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('typescript') || lower.includes('ts') || lower.includes('type')) {
    return 'typescript';
  }
  if (lower.includes('sql') || lower.includes('database') || lower.includes('sqlite')) {
    return 'database';
  }
  if (lower.includes('import') || lower.includes('module') || lower.includes('require')) {
    return 'module';
  }
  if (lower.includes('async') || lower.includes('await') || lower.includes('promise')) {
    return 'async';
  }
  if (lower.includes('test') || lower.includes('expect') || lower.includes('vitest')) {
    return 'test';
  }
  if (lower.includes('route') || lower.includes('express') || lower.includes('api')) {
    return 'api';
  }
  if (lower.includes('json') || lower.includes('parse')) {
    return 'json';
  }

  return 'unknown';
}

/**
 * Truncate long error messages while preserving key information
 */
function truncateMessage(message: string, maxLength: number = 200): string {
  if (message.length <= maxLength) {
    return message;
  }

  // Try to truncate at a word boundary
  const truncated = message.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Remove duplicate gotchas (same fix for same file pattern)
 */
function deduplicateGotchas(gotchas: ExtractedGotcha[]): ExtractedGotcha[] {
  const seen = new Map<string, ExtractedGotcha>();

  for (const gotcha of gotchas) {
    const key = `${gotcha.filePattern}:${gotcha.fix}`;
    if (!seen.has(key)) {
      seen.set(key, gotcha);
    }
  }

  return Array.from(seen.values());
}

/**
 * Generate a human-readable description for a gotcha
 */
export function generateGotchaDescription(gotcha: ExtractedGotcha): string {
  return `When working with ${gotcha.filePattern} files (${gotcha.actionType} action): ${gotcha.fix}`;
}
