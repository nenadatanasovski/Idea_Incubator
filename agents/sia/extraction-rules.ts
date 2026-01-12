// agents/sia/extraction-rules.ts - Predefined rules for extracting gotchas

export interface ExtractionRule {
  name: string;
  errorPattern: RegExp;
  filePattern: string;
  actionType?: string;
  fix: string;
}

export const EXTRACTION_RULES: ExtractionRule[] = [
  // SQLite gotchas
  {
    name: 'sqlite-date-type',
    errorPattern: /DATETIME|TIMESTAMP|DATE\s+not\s+supported|invalid\s+date/i,
    filePattern: '*.sql',
    fix: 'Use TEXT for dates in SQLite, not DATETIME. Store ISO 8601 strings.',
  },
  {
    name: 'sqlite-boolean',
    errorPattern: /BOOLEAN|TRUE|FALSE\s+not\s+supported/i,
    filePattern: '*.sql',
    fix: 'Use INTEGER (0/1) for booleans in SQLite, not BOOLEAN.',
  },
  {
    name: 'foreign-key-pragma',
    errorPattern: /FOREIGN KEY constraint failed|foreign key mismatch/i,
    filePattern: '*.sql',
    fix: 'Enable PRAGMA foreign_keys = ON before foreign key operations.',
  },

  // TypeScript/ES Module gotchas
  {
    name: 'import-extension',
    errorPattern: /Cannot find module|ERR_MODULE_NOT_FOUND|\.ts.*not found/i,
    filePattern: '*.ts',
    fix: 'Add .js extension to imports for ES modules (import from "./file.js").',
  },
  {
    name: 'async-await-missing',
    errorPattern: /Promise.*is not assignable|object is not iterable.*Promise/i,
    filePattern: '*.ts',
    fix: 'Ensure async functions are awaited. Check for missing await keyword.',
  },
  {
    name: 'type-assertion-needed',
    errorPattern: /Type.*is not assignable to type|implicit.*any/i,
    filePattern: '*.ts',
    fix: 'Add explicit type assertions or annotations where types cannot be inferred.',
  },

  // sql.js specific gotchas
  {
    name: 'sql-js-api-run',
    errorPattern: /run\s+is not a function|\.run\(\).*undefined/i,
    filePattern: '*.ts',
    fix: 'Use sql.js API: db.run() for writes, db.prepare().bind().step() for reads.',
  },
  {
    name: 'sql-js-async-getdb',
    errorPattern: /prepare.*not.*function.*Promise|getDb.*Promise/i,
    filePattern: '*.ts',
    fix: 'getDb() returns a Promise. Always use await getDb() before database operations.',
  },
  {
    name: 'sql-js-stmt-free',
    errorPattern: /statement.*already.*freed|use.*freed.*statement/i,
    filePattern: '*.ts',
    fix: 'Call stmt.free() only once after finishing with a prepared statement.',
  },

  // Express route gotchas
  {
    name: 'express-return-type',
    errorPattern: /Not all code paths return a value|7030/,
    filePattern: 'server/routes/*.ts',
    fix: 'Use Promise<void> return type and explicit return after res.json()/res.status().',
  },
  {
    name: 'express-async-handler',
    errorPattern: /UnhandledPromiseRejection|async.*handler.*error/i,
    filePattern: 'server/routes/*.ts',
    fix: 'Wrap async route handlers in try/catch and call res.status(500).json().',
  },

  // JSON handling gotchas
  {
    name: 'json-parse-null',
    errorPattern: /Cannot read.*null|JSON\.parse.*null/i,
    filePattern: '*.ts',
    fix: 'Check for null/undefined before JSON.parse(). Use default value: JSON.parse(val || "[]").',
  },

  // Test gotchas
  {
    name: 'vitest-import',
    errorPattern: /Cannot use import statement outside a module.*vitest/i,
    filePattern: 'tests/*.ts',
    fix: 'Ensure vitest.config.ts has proper ESM configuration.',
  },
  {
    name: 'test-async-done',
    errorPattern: /Async callback was not invoked|timeout.*exceeded/i,
    filePattern: 'tests/*.ts',
    fix: 'Use async/await in tests instead of done() callback. Ensure all Promises resolve.',
  },
];

/**
 * Find matching extraction rule for an error message
 */
export function matchExtractionRule(
  errorMessage: string,
  filePath?: string
): ExtractionRule | null {
  for (const rule of EXTRACTION_RULES) {
    if (rule.errorPattern.test(errorMessage)) {
      // If filePath provided, also check file pattern matches
      if (filePath && !matchesFilePattern(filePath, rule.filePattern)) {
        continue;
      }
      return rule;
    }
  }
  return null;
}

/**
 * Check if a file path matches a glob-like pattern
 */
export function matchesFilePattern(filePath: string, pattern: string): boolean {
  // Simple pattern matching (supports *.ext and dir/*)
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    return filePath.endsWith(ext);
  }
  if (pattern.endsWith('/*')) {
    const dir = pattern.slice(0, -2);
    return filePath.includes(dir + '/');
  }
  if (pattern.endsWith('/*.ts')) {
    const dir = pattern.slice(0, -5);
    return filePath.includes(dir + '/') && filePath.endsWith('.ts');
  }
  return filePath.includes(pattern);
}

/**
 * Infer file pattern from a file path
 */
export function inferFilePattern(filePath: string): string {
  if (filePath.endsWith('.sql')) return '*.sql';
  if (filePath.endsWith('.ts')) {
    if (filePath.includes('server/routes/')) return 'server/routes/*.ts';
    if (filePath.includes('tests/')) return 'tests/*.ts';
    return '*.ts';
  }
  if (filePath.endsWith('.tsx')) return '*.tsx';
  if (filePath.endsWith('.js')) return '*.js';
  return '*';
}

/**
 * Infer action type from task action string
 */
export function inferActionType(action: string): string {
  const normalized = action.toUpperCase();
  if (normalized.includes('CREATE') || normalized.includes('ADD')) return 'CREATE';
  if (normalized.includes('UPDATE') || normalized.includes('MODIFY')) return 'UPDATE';
  if (normalized.includes('DELETE') || normalized.includes('REMOVE')) return 'DELETE';
  if (normalized.includes('VERIFY') || normalized.includes('CHECK')) return 'VERIFY';
  return 'UNKNOWN';
}
