/**
 * UNIFIED ARTIFACT STORE
 *
 * Filesystem-based artifact storage where artifacts ARE files.
 * The database becomes a lightweight index, and `.metadata/index.json`
 * serves as a regenerable cache for fast UI loading.
 */

import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../../config/index.js';
import { createUserFolder, createIdeaFolder as createIdeaFolderFromUtils } from '../../utils/folder-structure.js';

// Re-export createIdeaFolder for convenient access
export { createIdeaFolderFromUtils as createIdeaFolder };

/**
 * Supported artifact types
 */
export type ArtifactType =
  | 'research'
  | 'mermaid'
  | 'markdown'
  | 'code'
  | 'analysis'
  | 'comparison'
  | 'idea-summary'
  | 'template';

/**
 * Metadata stored in YAML frontmatter of artifact files
 */
export interface ArtifactMetadata {
  /** Unique identifier for the artifact */
  id: string;
  /** Human-readable title */
  title: string;
  /** Type of artifact */
  type: ArtifactType;
  /** User who owns this artifact */
  userSlug?: string;
  /** Idea this artifact belongs to */
  ideaSlug?: string;
  /** Session that created this artifact (if any) */
  sessionId?: string;
  /** Programming language (for code artifacts) */
  language?: string;
  /** Search queries used to generate this artifact */
  queries?: string[];
  /** Optional identifier for artifact-specific lookups */
  identifier?: string;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
  /** Any additional custom fields */
  [key: string]: unknown;
}

/**
 * Unified artifact interface representing a file-backed artifact
 */
export interface UnifiedArtifact {
  /** Unique identifier for the artifact */
  id: string;
  /** User slug (owner) */
  userSlug: string;
  /** Idea slug this artifact belongs to */
  ideaSlug: string;
  /** Session ID that created this artifact (optional for templates) */
  sessionId?: string;
  /** Type of artifact */
  type: ArtifactType;
  /** Human-readable title */
  title: string;
  /** Relative file path within the idea folder */
  filePath: string;
  /** Estimated token count for the artifact content */
  tokenCount: number;
  /** Current status of the artifact */
  status: 'ready' | 'updating' | 'error';
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Input for creating a new artifact
 */
export interface CreateArtifactInput {
  /** Type of artifact */
  type: ArtifactType;
  /** Human-readable title */
  title: string;
  /** Content body of the artifact */
  content: string;
  /** Optional file path (auto-generated if not provided) */
  filePath?: string;
  /** Session ID that created this artifact */
  sessionId?: string;
  /** Programming language (for code artifacts) */
  language?: string;
  /** Search queries used to generate this artifact */
  queries?: string[];
  /** Optional identifier for artifact-specific lookups */
  identifier?: string;
}

/**
 * Result of token limit check
 */
export interface TokenCheckResult {
  /** Number of tokens in the content */
  tokens: number;
  /** Whether the content exceeds the 15k token limit */
  exceedsLimit: boolean;
  /** Suggested split points if content exceeds limit */
  suggestedSplits?: string[];
}

/**
 * Cache index structure stored in .metadata/index.json
 */
export interface ArtifactCacheIndex {
  /** Timestamp when cache was last updated */
  updatedAt: string;
  /** Map of file paths to artifact summaries */
  artifacts: Record<string, ArtifactCacheSummary>;
}

/**
 * Summary of an artifact stored in the cache index
 */
export interface ArtifactCacheSummary {
  /** Unique identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** Type of artifact */
  type: ArtifactType;
  /** Relative file path */
  filePath: string;
  /** Session ID (if any) */
  sessionId?: string;
  /** Token count */
  tokenCount: number;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Result of parsing frontmatter from a file
 */
export interface ParsedFrontmatter {
  /** Parsed metadata from YAML frontmatter */
  metadata: Partial<ArtifactMetadata>;
  /** Body content after the frontmatter */
  body: string;
}

/**
 * Parse YAML frontmatter from markdown content.
 *
 * Handles files with frontmatter delimited by `---`:
 * ```
 * ---
 * id: abc123
 * title: Test
 * ---
 * Body content
 * ```
 *
 * @param content - The full file content including frontmatter
 * @returns Object with parsed metadata and body content
 * @throws Error if frontmatter contains invalid YAML
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  // Handle empty content
  if (!content || content.trim() === '') {
    return { metadata: {}, body: '' };
  }

  // Check if content starts with frontmatter delimiter
  const trimmedContent = content.trimStart();
  if (!trimmedContent.startsWith('---')) {
    // No frontmatter, return full content as body
    return { metadata: {}, body: content };
  }

  // Find the closing delimiter
  // The frontmatter format is:
  // ---
  // yaml content
  // ---
  // body content

  const lines = content.split('\n');
  let frontmatterStartIndex = -1;
  let frontmatterEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---') {
      if (frontmatterStartIndex === -1) {
        frontmatterStartIndex = i;
      } else {
        frontmatterEndIndex = i;
        break;
      }
    }
  }

  // If we didn't find a closing delimiter, treat as no frontmatter
  if (frontmatterEndIndex === -1) {
    return { metadata: {}, body: content };
  }

  // Extract YAML content between delimiters
  const yamlLines = lines.slice(frontmatterStartIndex + 1, frontmatterEndIndex);
  const yamlContent = yamlLines.join('\n');

  // Extract body content after closing delimiter
  const bodyLines = lines.slice(frontmatterEndIndex + 1);
  // Remove leading empty line if present (common formatting)
  let body = bodyLines.join('\n');
  if (body.startsWith('\n')) {
    body = body.slice(1);
  }

  // If YAML content is empty, return empty metadata
  if (yamlContent.trim() === '') {
    return { metadata: {}, body };
  }

  // Parse YAML
  try {
    const parsed = yaml.parse(yamlContent);

    // Ensure we return an object even if YAML parses to null
    const metadata: Partial<ArtifactMetadata> = parsed && typeof parsed === 'object' ? parsed : {};

    return { metadata, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Invalid YAML in frontmatter: ${message}`);
  }
}

/**
 * Generate YAML frontmatter from metadata object.
 *
 * Converts a metadata object to YAML frontmatter format:
 * ```
 * ---
 * id: abc123
 * title: "Test"
 * type: markdown
 * ---
 * ```
 *
 * @param metadata - The metadata object to convert to frontmatter
 * @returns YAML frontmatter string with `---` delimiters
 */
export function generateFrontmatter(metadata: Partial<ArtifactMetadata>): string {
  // Handle empty metadata - return minimal valid frontmatter
  if (!metadata || Object.keys(metadata).length === 0) {
    return '---\n---\n';
  }

  // Convert metadata to YAML
  const yamlContent = yaml.stringify(metadata, {
    // Use double quotes for strings when needed
    defaultStringType: 'PLAIN',
    // Don't add document markers within the yaml content
    defaultKeyType: 'PLAIN',
    // Line width for wrapping
    lineWidth: 0, // Disable line wrapping to preserve values
  });

  // Wrap with delimiters
  return `---\n${yamlContent}---\n`;
}

/**
 * Token limit constant - 15,000 tokens
 */
const TOKEN_LIMIT = 15000;

/**
 * Estimate the number of tokens in a string.
 *
 * Uses a cl100k_base-style approximation that accounts for different content types:
 * - Standard text: ~4 characters per token
 * - Code: slightly more tokens due to special characters
 * - Markdown: accounts for formatting syntax
 *
 * This approximation is within ~10% of actual token counts for most content.
 *
 * @param content - The string content to count tokens for
 * @returns Estimated number of tokens
 */
export function estimateTokens(content: string): number {
  // Handle empty content
  if (!content || content.length === 0) {
    return 0;
  }

  // Base estimation: cl100k_base tokenizer averages ~4 characters per token for English
  // But this varies based on content type

  // Count different character types for more accurate estimation
  const codeBlockMatches = content.match(/```[\s\S]*?```/g) || [];
  const inlineCodeMatches = content.match(/`[^`]+`/g) || [];

  // Calculate code content length
  let codeLength = 0;
  for (const block of codeBlockMatches) {
    codeLength += block.length;
  }
  for (const inline of inlineCodeMatches) {
    codeLength += inline.length;
  }

  // Non-code content
  const textLength = content.length - codeLength;

  // Token estimation:
  // - Code tends to have more tokens per character (~3.5 chars/token) due to special chars
  // - Regular text averages ~4 chars/token
  // - Whitespace and punctuation count as separate tokens sometimes

  const codeTokens = Math.ceil(codeLength / 3.5);
  const textTokens = Math.ceil(textLength / 4);

  // Add adjustment for newlines (each newline can sometimes be its own token)
  const newlineCount = (content.match(/\n/g) || []).length;
  const newlineAdjustment = Math.ceil(newlineCount * 0.1); // ~10% of newlines become separate tokens

  // Add adjustment for special markdown syntax
  const markdownSyntax = (content.match(/[#*_\[\](){}|>-]/g) || []).length;
  const markdownAdjustment = Math.ceil(markdownSyntax * 0.05); // Small adjustment for markdown chars

  return codeTokens + textTokens + newlineAdjustment + markdownAdjustment;
}

/**
 * Find potential split points in content based on markdown headings.
 *
 * @param content - The markdown content to analyze
 * @returns Array of heading texts that could serve as split points
 */
function findSplitPoints(content: string): string[] {
  const headings: string[] = [];

  // Find all markdown headings (# through ###)
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push(match[2].trim());
  }

  // If no headings found, suggest splitting by paragraphs
  if (headings.length === 0) {
    // Find paragraph breaks (double newlines)
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) {
      // Return first few words of each paragraph as potential split points
      return paragraphs.slice(0, 5).map((p) => {
        const firstLine = p.split('\n')[0];
        const words = firstLine.trim().split(/\s+/).slice(0, 5);
        return words.join(' ') + '...';
      });
    }
  }

  return headings;
}

/**
 * Check if content exceeds the token limit and provide split suggestions.
 *
 * @param content - The content to check
 * @returns TokenCheckResult with token count, limit status, and split suggestions
 */
export function checkTokenLimit(content: string): TokenCheckResult {
  const tokens = estimateTokens(content);
  const exceedsLimit = tokens > TOKEN_LIMIT;

  const result: TokenCheckResult = {
    tokens,
    exceedsLimit,
  };

  // If exceeds limit, provide split suggestions based on headings
  if (exceedsLimit) {
    const splitPoints = findSplitPoints(content);
    if (splitPoints.length > 0) {
      result.suggestedSplits = splitPoints;
    }
  }

  return result;
}

/**
 * Get the root directory for users
 */
function getUsersRoot(): string {
  const config = getConfig();
  // Users directory is at the same level as ideas directory
  const projectRoot = path.dirname(config.paths.ideas);
  return path.join(projectRoot, 'users');
}

/**
 * Generate a file path for an artifact based on its type and title.
 *
 * @param type - The artifact type
 * @param title - The artifact title
 * @returns Generated file path (e.g., 'research/market-analysis.md')
 */
function generateFilePath(type: ArtifactType, title: string): string {
  // Convert title to slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Map types to subdirectories
  const typeToDir: Record<ArtifactType, string> = {
    research: 'research',
    mermaid: 'assets/diagrams',
    markdown: '',
    code: 'build',
    analysis: 'analysis',
    comparison: 'analysis',
    'idea-summary': '',
    template: '',
  };

  const dir = typeToDir[type] || '';
  const extension = type === 'mermaid' ? '.mmd' : '.md';
  const fileName = `${slug}${extension}`;

  return dir ? `${dir}/${fileName}` : fileName;
}

/**
 * Update the .metadata/index.json cache with a new or updated artifact entry.
 *
 * @param ideaFolder - Absolute path to the idea folder
 * @param artifact - The artifact to add/update in the cache
 */
async function updateCacheWithArtifact(
  ideaFolder: string,
  artifact: UnifiedArtifact
): Promise<void> {
  const metadataFolder = path.join(ideaFolder, '.metadata');
  const indexPath = path.join(metadataFolder, 'index.json');

  // Ensure .metadata directory exists
  if (!fs.existsSync(metadataFolder)) {
    fs.mkdirSync(metadataFolder, { recursive: true });
  }

  // Read existing cache or create new one
  let cache: ArtifactCacheIndex;
  try {
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const parsed = JSON.parse(content);
      // Handle both old format (empty object) and new format
      cache = parsed.artifacts
        ? parsed
        : { updatedAt: new Date().toISOString(), artifacts: parsed };
    } else {
      cache = {
        updatedAt: new Date().toISOString(),
        artifacts: {},
      };
    }
  } catch {
    cache = {
      updatedAt: new Date().toISOString(),
      artifacts: {},
    };
  }

  // Update cache entry
  cache.artifacts[artifact.filePath] = {
    id: artifact.id,
    title: artifact.title,
    type: artifact.type,
    filePath: artifact.filePath,
    sessionId: artifact.sessionId,
    tokenCount: artifact.tokenCount,
    updatedAt: artifact.updatedAt,
  };

  // Update cache timestamp
  cache.updatedAt = new Date().toISOString();

  // Write cache
  fs.writeFileSync(indexPath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Save an artifact to the filesystem with frontmatter.
 *
 * Creates or updates a file at `users/[userSlug]/ideas/[ideaSlug]/[filePath]`
 * with YAML frontmatter containing metadata.
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param input - The artifact creation input
 * @returns The created/updated artifact
 */
export async function saveArtifact(
  userSlug: string,
  ideaSlug: string,
  input: CreateArtifactInput
): Promise<UnifiedArtifact> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  // Ensure user folder exists
  await createUserFolder(userSlug);

  // Ensure idea folder exists
  if (!fs.existsSync(ideaFolder)) {
    fs.mkdirSync(ideaFolder, { recursive: true });
  }

  // Determine file path
  const filePath = input.filePath || generateFilePath(input.type, input.title);
  const absolutePath = path.join(ideaFolder, filePath);

  // Check if file already exists to determine if this is an update
  let existingId: string | undefined;
  let existingCreatedAt: string | undefined;

  if (fs.existsSync(absolutePath)) {
    try {
      const existingContent = fs.readFileSync(absolutePath, 'utf-8');
      const { metadata } = parseFrontmatter(existingContent);
      existingId = metadata.id;
      existingCreatedAt = metadata.createdAt;
    } catch {
      // Ignore parse errors, treat as new file
    }
  }

  // Generate ID and timestamps
  const now = new Date().toISOString();
  const id = existingId || uuidv4();
  const createdAt = existingCreatedAt || now;
  const updatedAt = now;

  // Calculate token count
  const tokenCount = estimateTokens(input.content);

  // Build metadata for frontmatter
  const metadata: ArtifactMetadata = {
    id,
    title: input.title,
    type: input.type,
    userSlug,
    ideaSlug,
    createdAt,
    updatedAt,
  };

  // Add optional fields
  if (input.sessionId) {
    metadata.sessionId = input.sessionId;
  }
  if (input.language) {
    metadata.language = input.language;
  }
  if (input.queries && input.queries.length > 0) {
    metadata.queries = input.queries;
  }
  if (input.identifier) {
    metadata.identifier = input.identifier;
  }

  // Generate file content with frontmatter
  const frontmatter = generateFrontmatter(metadata);
  const fileContent = frontmatter + input.content;

  // Ensure parent directory exists (for nested paths like research/market.md)
  const parentDir = path.dirname(absolutePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(absolutePath, fileContent, 'utf-8');

  // Build artifact result
  const artifact: UnifiedArtifact = {
    id,
    userSlug,
    ideaSlug,
    sessionId: input.sessionId,
    type: input.type,
    title: input.title,
    filePath,
    tokenCount,
    status: 'ready',
    createdAt,
    updatedAt,
  };

  // Update cache
  await updateCacheWithArtifact(ideaFolder, artifact);

  return artifact;
}

/**
 * Normalize a file path for artifact loading.
 *
 * - Removes leading slashes
 * - Ensures .md extension for non-mermaid files
 * - Handles various path formats
 *
 * @param filePath - The file path to normalize
 * @returns Normalized file path
 */
function normalizeFilePath(filePath: string): string {
  // Remove leading slashes
  let normalized = filePath.replace(/^\/+/, '');

  // If the path doesn't have an extension, add .md
  // (unless it already ends with .mmd for mermaid diagrams)
  if (!path.extname(normalized)) {
    normalized = normalized + '.md';
  }

  return normalized;
}

/**
 * Load an artifact from the filesystem.
 *
 * Reads a file from `users/[userSlug]/ideas/[ideaSlug]/[filePath]`,
 * parses its frontmatter, and returns a populated UnifiedArtifact.
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param filePath - Relative file path within the idea folder
 * @returns The loaded artifact, or null if file not found
 */
export async function loadArtifact(
  userSlug: string,
  ideaSlug: string,
  filePath: string
): Promise<UnifiedArtifact | null> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  // Normalize the file path
  const normalizedPath = normalizeFilePath(filePath);
  const absolutePath = path.join(ideaFolder, normalizedPath);

  // Check if file exists - return null instead of throwing
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  // Read file content
  let content: string;
  try {
    content = fs.readFileSync(absolutePath, 'utf-8');
  } catch {
    // If we can't read the file for any reason, return null
    return null;
  }

  // Parse frontmatter
  const { metadata, body } = parseFrontmatter(content);

  // Calculate token count from the body content
  const tokenCount = estimateTokens(body);

  // Get file stats for timestamps if not in metadata
  const stats = fs.statSync(absolutePath);

  // Generate default metadata for files without proper frontmatter
  const id = metadata.id || uuidv4();
  const title = metadata.title || path.basename(normalizedPath, path.extname(normalizedPath));
  const type: ArtifactType = (metadata.type as ArtifactType) || 'markdown';
  const createdAt = metadata.createdAt || stats.birthtime.toISOString();
  const updatedAt = metadata.updatedAt || stats.mtime.toISOString();

  // Build and return the artifact
  const artifact: UnifiedArtifact = {
    id,
    userSlug: metadata.userSlug || userSlug,
    ideaSlug: metadata.ideaSlug || ideaSlug,
    sessionId: metadata.sessionId,
    type,
    title,
    filePath: normalizedPath,
    tokenCount,
    status: 'ready',
    createdAt,
    updatedAt,
  };

  return artifact;
}

/**
 * Read the cache index from .metadata/index.json if it exists.
 *
 * @param ideaFolder - Absolute path to the idea folder
 * @returns The cache index or null if not available/invalid
 */
function readCacheIndex(ideaFolder: string): ArtifactCacheIndex | null {
  const indexPath = path.join(ideaFolder, '.metadata', 'index.json');

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both old format (just artifacts object) and new format (with updatedAt)
    if (parsed.artifacts && typeof parsed.artifacts === 'object') {
      return parsed as ArtifactCacheIndex;
    }

    // Old format - convert
    return {
      updatedAt: new Date().toISOString(),
      artifacts: parsed,
    };
  } catch {
    return null;
  }
}

/**
 * Recursively find all markdown files in a directory.
 *
 * @param dir - Directory to search
 * @param baseDir - Base directory for relative paths
 * @param excludeDirs - Directories to exclude (e.g., .metadata, .versions)
 * @returns Array of relative file paths
 */
function findMarkdownFilesRecursively(
  dir: string,
  baseDir: string,
  excludeDirs: string[] = ['.metadata', '.versions']
): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Skip excluded directories
      if (excludeDirs.includes(entry.name)) {
        continue;
      }
      // Recurse into subdirectory
      results.push(...findMarkdownFilesRecursively(fullPath, baseDir, excludeDirs));
    } else if (entry.isFile()) {
      // Include markdown and mermaid files
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.md' || ext === '.mmd') {
        results.push(relativePath);
      }
    }
  }

  return results;
}

/**
 * Build cache from filesystem by scanning all markdown files.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @param ideaFolder - Absolute path to the idea folder
 * @returns Array of artifacts found
 */
async function buildCacheFromFilesystem(
  userSlug: string,
  ideaSlug: string,
  ideaFolder: string
): Promise<UnifiedArtifact[]> {
  const artifacts: UnifiedArtifact[] = [];
  const filePaths = findMarkdownFilesRecursively(ideaFolder, ideaFolder);

  for (const filePath of filePaths) {
    const artifact = await loadArtifact(userSlug, ideaSlug, filePath);
    if (artifact) {
      artifacts.push(artifact);
    }
  }

  // Update the cache with all found artifacts
  const metadataFolder = path.join(ideaFolder, '.metadata');
  const indexPath = path.join(metadataFolder, 'index.json');

  // Ensure .metadata directory exists
  if (!fs.existsSync(metadataFolder)) {
    fs.mkdirSync(metadataFolder, { recursive: true });
  }

  // Build cache index
  const cache: ArtifactCacheIndex = {
    updatedAt: new Date().toISOString(),
    artifacts: {},
  };

  for (const artifact of artifacts) {
    cache.artifacts[artifact.filePath] = {
      id: artifact.id,
      title: artifact.title,
      type: artifact.type,
      filePath: artifact.filePath,
      sessionId: artifact.sessionId,
      tokenCount: artifact.tokenCount,
      updatedAt: artifact.updatedAt,
    };
  }

  // Write cache
  fs.writeFileSync(indexPath, JSON.stringify(cache, null, 2), 'utf-8');

  return artifacts;
}

/**
 * List all artifacts in an idea folder.
 *
 * Returns artifacts from cache if available and valid, otherwise rebuilds
 * the cache by scanning the filesystem. Results are sorted by updatedAt
 * descending (most recent first).
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @returns Array of artifacts, empty array if folder doesn't exist
 */
export async function listArtifacts(
  userSlug: string,
  ideaSlug: string
): Promise<UnifiedArtifact[]> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  // If folder doesn't exist, return empty array (no throw)
  if (!fs.existsSync(ideaFolder)) {
    return [];
  }

  // Try to read from cache first
  const cache = readCacheIndex(ideaFolder);

  let artifacts: UnifiedArtifact[];

  if (cache && cache.artifacts && Object.keys(cache.artifacts).length > 0) {
    // Use cache - convert cache entries to UnifiedArtifact objects
    artifacts = Object.values(cache.artifacts).map((entry) => ({
      id: entry.id,
      userSlug,
      ideaSlug,
      sessionId: entry.sessionId,
      type: entry.type,
      title: entry.title,
      filePath: entry.filePath,
      tokenCount: entry.tokenCount,
      status: 'ready' as const,
      createdAt: entry.updatedAt, // Cache doesn't store createdAt, use updatedAt
      updatedAt: entry.updatedAt,
    }));
  } else {
    // Cache missing or empty - rebuild from filesystem
    artifacts = await buildCacheFromFilesystem(userSlug, ideaSlug, ideaFolder);
  }

  // Sort by updatedAt descending (most recent first)
  artifacts.sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateB - dateA;
  });

  return artifacts;
}

/**
 * Internal function to remove an entry from the .metadata/index.json cache.
 *
 * @param ideaFolder - Absolute path to the idea folder
 * @param filePath - Relative file path of the artifact to remove
 */
async function removeCacheEntryInternal(ideaFolder: string, filePath: string): Promise<void> {
  const indexPath = path.join(ideaFolder, '.metadata', 'index.json');

  // If cache doesn't exist, nothing to do
  if (!fs.existsSync(indexPath)) {
    return;
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both old format (just artifacts object) and new format (with updatedAt)
    let cache: ArtifactCacheIndex;
    if (parsed.artifacts && typeof parsed.artifacts === 'object') {
      cache = parsed as ArtifactCacheIndex;
    } else {
      // Old format - convert
      cache = {
        updatedAt: new Date().toISOString(),
        artifacts: parsed as Record<string, ArtifactCacheSummary>,
      };
    }

    // Remove the entry
    if (cache.artifacts[filePath]) {
      delete cache.artifacts[filePath];

      // Update timestamp and write back
      cache.updatedAt = new Date().toISOString();

      fs.writeFileSync(indexPath, JSON.stringify(cache, null, 2), 'utf-8');
    }
  } catch {
    // If we can't update the cache, just continue
    // The cache will be rebuilt on next access
  }
}

/**
 * Delete an artifact from the filesystem.
 *
 * Removes the file at `users/[userSlug]/ideas/[ideaSlug]/[filePath]`
 * and updates the cache to remove the entry.
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param filePath - Relative file path within the idea folder
 * @returns true if file was deleted, false if file not found
 */
export async function deleteArtifact(
  userSlug: string,
  ideaSlug: string,
  filePath: string
): Promise<boolean> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  // Normalize the file path
  const normalizedPath = normalizeFilePath(filePath);
  const absolutePath = path.join(ideaFolder, normalizedPath);

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  // Check if it's a file (not a directory) - only delete files
  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return false;
  }

  // Delete the file
  try {
    fs.unlinkSync(absolutePath);
  } catch {
    // If deletion fails for any reason, return false
    return false;
  }

  // Update cache to remove the entry
  await removeCacheEntryInternal(ideaFolder, normalizedPath);

  return true;
}

/**
 * Rebuild the .metadata/index.json cache by scanning all markdown files.
 *
 * Scans all .md files in the idea folder recursively, parses frontmatter,
 * and builds a fresh index. This function:
 * - Creates .metadata/index.json if missing
 * - Overwrites existing cache completely
 * - Includes all .md files recursively
 * - Excludes .metadata/ and .versions/ directories
 * - Handles files without frontmatter (generates entry with inferred data)
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 */
export async function rebuildCache(userSlug: string, ideaSlug: string): Promise<void> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  // If folder doesn't exist, create empty cache
  if (!fs.existsSync(ideaFolder)) {
    return;
  }

  // Find all markdown files, excluding .metadata and .versions directories
  const filePaths = findMarkdownFilesRecursively(ideaFolder, ideaFolder, ['.metadata', '.versions']);

  // Build cache index
  const cache: ArtifactCacheIndex = {
    updatedAt: new Date().toISOString(),
    artifacts: {},
  };

  // Process each file
  for (const filePath of filePaths) {
    const absolutePath = path.join(ideaFolder, filePath);

    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const { metadata, body } = parseFrontmatter(content);

      // Get file stats for fallback timestamps
      const stats = fs.statSync(absolutePath);

      // Calculate token count from body content
      const tokenCount = estimateTokens(body);

      // Generate entry - use metadata values or inferred defaults
      const id = metadata.id || uuidv4();
      const title = metadata.title || path.basename(filePath, path.extname(filePath));
      const type: ArtifactType = (metadata.type as ArtifactType) || 'markdown';
      const updatedAt = metadata.updatedAt || stats.mtime.toISOString();

      // Build cache entry
      cache.artifacts[filePath] = {
        id,
        title,
        type,
        filePath,
        sessionId: metadata.sessionId,
        tokenCount,
        updatedAt,
      };
    } catch {
      // If we can't read or parse the file, skip it
      continue;
    }
  }

  // Ensure .metadata directory exists
  const metadataFolder = path.join(ideaFolder, '.metadata');
  if (!fs.existsSync(metadataFolder)) {
    fs.mkdirSync(metadataFolder, { recursive: true });
  }

  // Write cache
  const indexPath = path.join(metadataFolder, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Update a single entry in the cache without rebuilding the entire cache.
 *
 * This is more efficient than rebuildCache when only one artifact has changed.
 * The operation is atomic - partial writes don't corrupt the cache.
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param artifact - The artifact to add or update in the cache
 */
export async function updateCacheEntry(
  userSlug: string,
  ideaSlug: string,
  artifact: UnifiedArtifact
): Promise<void> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  const metadataFolder = path.join(ideaFolder, '.metadata');
  const indexPath = path.join(metadataFolder, 'index.json');
  const tempPath = path.join(metadataFolder, 'index.json.tmp');

  // Ensure .metadata directory exists
  if (!fs.existsSync(metadataFolder)) {
    fs.mkdirSync(metadataFolder, { recursive: true });
  }

  // Read existing cache or create new one
  let cache: ArtifactCacheIndex;
  try {
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const parsed = JSON.parse(content);
      // Handle both old format (empty object) and new format
      cache = parsed.artifacts
        ? parsed
        : { updatedAt: new Date().toISOString(), artifacts: parsed };
    } else {
      cache = {
        updatedAt: new Date().toISOString(),
        artifacts: {},
      };
    }
  } catch {
    cache = {
      updatedAt: new Date().toISOString(),
      artifacts: {},
    };
  }

  // Update cache entry
  cache.artifacts[artifact.filePath] = {
    id: artifact.id,
    title: artifact.title,
    type: artifact.type,
    filePath: artifact.filePath,
    sessionId: artifact.sessionId,
    tokenCount: artifact.tokenCount,
    updatedAt: artifact.updatedAt,
  };

  // Update cache timestamp
  cache.updatedAt = new Date().toISOString();

  // Atomic write: write to temp file first, then rename
  const cacheContent = JSON.stringify(cache, null, 2);
  fs.writeFileSync(tempPath, cacheContent, 'utf-8');
  fs.renameSync(tempPath, indexPath);
}

/**
 * Remove a single entry from the cache without rebuilding the entire cache.
 *
 * This is more efficient than rebuildCache when only one artifact has been deleted.
 * The operation is atomic - partial writes don't corrupt the cache.
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param filePath - Relative file path of the artifact to remove
 */
export async function removeCacheEntry(
  userSlug: string,
  ideaSlug: string,
  filePath: string
): Promise<void> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  const metadataFolder = path.join(ideaFolder, '.metadata');
  const indexPath = path.join(metadataFolder, 'index.json');
  const tempPath = path.join(metadataFolder, 'index.json.tmp');

  // If cache doesn't exist, nothing to do
  if (!fs.existsSync(indexPath)) {
    return;
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both old format (just artifacts object) and new format (with updatedAt)
    let cache: ArtifactCacheIndex;
    if (parsed.artifacts && typeof parsed.artifacts === 'object') {
      cache = parsed as ArtifactCacheIndex;
    } else {
      // Old format - convert
      cache = {
        updatedAt: new Date().toISOString(),
        artifacts: parsed as Record<string, ArtifactCacheSummary>,
      };
    }

    // Normalize the file path
    const normalizedPath = normalizeFilePath(filePath);

    // Remove the entry if it exists
    if (cache.artifacts[normalizedPath]) {
      delete cache.artifacts[normalizedPath];

      // Update timestamp
      cache.updatedAt = new Date().toISOString();

      // Atomic write: write to temp file first, then rename
      const cacheContent = JSON.stringify(cache, null, 2);
      fs.writeFileSync(tempPath, cacheContent, 'utf-8');
      fs.renameSync(tempPath, indexPath);
    }
  } catch {
    // If we can't update the cache, just continue
    // The cache will be rebuilt on next access
  }
}

/**
 * Check if the cache is valid by comparing file modification times.
 *
 * The cache is considered invalid if:
 * - The cache file doesn't exist
 * - Any markdown file in the idea folder has been modified after the cache timestamp
 * - The cache file itself is corrupted or unreadable
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @returns true if cache is valid and up-to-date, false otherwise
 */
export async function isCacheValid(
  userSlug: string,
  ideaSlug: string
): Promise<boolean> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  const indexPath = path.join(ideaFolder, '.metadata', 'index.json');

  // If cache file doesn't exist, it's not valid
  if (!fs.existsSync(indexPath)) {
    return false;
  }

  // Read and parse the cache to get its timestamp
  let cache: ArtifactCacheIndex;
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both old format and new format
    if (parsed.artifacts && typeof parsed.artifacts === 'object' && parsed.updatedAt) {
      cache = parsed as ArtifactCacheIndex;
    } else {
      // Old format without updatedAt - consider invalid
      return false;
    }
  } catch {
    // Cache is corrupted or unreadable
    return false;
  }

  // Parse cache timestamp
  const cacheTime = new Date(cache.updatedAt).getTime();
  if (isNaN(cacheTime)) {
    // Invalid timestamp
    return false;
  }

  // Use the cache file's mtime as the reference point for comparison
  // This is more reliable than the JSON timestamp because it reflects
  // when the file was actually written to disk
  let cacheFileMtime: number;
  try {
    const cacheStats = fs.statSync(indexPath);
    cacheFileMtime = cacheStats.mtime.getTime();
  } catch {
    return false;
  }

  // Find all markdown files and check their modification times
  const filePaths = findMarkdownFilesRecursively(ideaFolder, ideaFolder, ['.metadata', '.versions']);

  for (const filePath of filePaths) {
    const absolutePath = path.join(ideaFolder, filePath);

    try {
      const stats = fs.statSync(absolutePath);
      const fileMtime = stats.mtime.getTime();

      // If any file was modified after the cache file was written, cache is invalid
      // We compare against the cache file's mtime, not the JSON timestamp,
      // because this accounts for filesystem timestamp resolution
      if (fileMtime > cacheFileMtime) {
        return false;
      }
    } catch {
      // If we can't stat a file, consider cache invalid to be safe
      return false;
    }
  }

  // All files are older than the cache - cache is valid
  return true;
}

/**
 * Delete all artifacts belonging to a specific session.
 *
 * Finds all files with matching sessionId in their frontmatter and deletes them.
 * Template files (files without sessionId) are not affected.
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param sessionId - The session ID to match
 * @returns Number of files deleted
 */
export async function deleteSessionArtifacts(
  userSlug: string,
  ideaSlug: string,
  sessionId: string
): Promise<number> {
  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  // If folder doesn't exist, return 0 (no throw)
  if (!fs.existsSync(ideaFolder)) {
    return 0;
  }

  // Find all markdown files in the idea folder
  const filePaths = findMarkdownFilesRecursively(ideaFolder, ideaFolder);

  let deletedCount = 0;

  // Check each file for matching sessionId
  for (const filePath of filePaths) {
    const absolutePath = path.join(ideaFolder, filePath);

    try {
      // Read and parse the file to check its sessionId
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const { metadata } = parseFrontmatter(content);

      // Only delete files with matching sessionId
      // Files without sessionId (template files) are preserved
      if (metadata.sessionId === sessionId) {
        // Delete the file
        fs.unlinkSync(absolutePath);

        // Update cache
        await removeCacheEntryInternal(ideaFolder, filePath);

        deletedCount++;
      }
    } catch {
      // If we can't read or parse the file, skip it
      continue;
    }
  }

  return deletedCount;
}

/**
 * Rename an idea folder and update all references.
 *
 * This function:
 * 1. Renames the folder on filesystem
 * 2. Updates ideaSlug in frontmatter of all files
 * 3. Updates database references (ideation_sessions, ideation_artifacts)
 * 4. Updates relationships in .metadata/relationships.json
 * 5. Rebuilds the cache
 *
 * @param userSlug - The user slug (owner)
 * @param oldSlug - The current idea slug
 * @param newSlug - The new idea slug
 * @throws Error if new slug already exists or old folder doesn't exist
 */
export async function renameIdeaFolder(
  userSlug: string,
  oldSlug: string,
  newSlug: string
): Promise<void> {
  const usersRoot = getUsersRoot();
  const oldPath = path.resolve(usersRoot, userSlug, 'ideas', oldSlug);
  const newPath = path.resolve(usersRoot, userSlug, 'ideas', newSlug);

  // Verify old folder exists
  if (!fs.existsSync(oldPath)) {
    throw new Error(`Idea folder does not exist: ${oldPath}`);
  }

  // Verify new slug doesn't already exist
  if (fs.existsSync(newPath)) {
    throw new Error(`Idea folder already exists: ${newPath}`);
  }

  // Rename the folder on filesystem
  fs.renameSync(oldPath, newPath);

  // Find all markdown files and update frontmatter
  const filePaths = findMarkdownFilesRecursively(newPath, newPath, ['.metadata', '.versions']);

  for (const filePath of filePaths) {
    const absolutePath = path.join(newPath, filePath);

    try {
      // Read file content
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const { metadata, body } = parseFrontmatter(content);

      // Update ideaSlug in frontmatter if present
      if (metadata.ideaSlug === oldSlug || metadata.ideaSlug === undefined) {
        metadata.ideaSlug = newSlug;

        // Also update the 'id' field if it matches the old slug
        if (metadata.id === oldSlug) {
          metadata.id = newSlug;
        }

        // Update the updatedAt timestamp
        metadata.updatedAt = new Date().toISOString();

        // Regenerate frontmatter and write file
        const newFrontmatter = generateFrontmatter(metadata);
        const newContent = newFrontmatter + body;
        fs.writeFileSync(absolutePath, newContent, 'utf-8');
      }
    } catch {
      // If we can't update a file, continue with the rest
      continue;
    }
  }

  // Update .metadata/relationships.json if it exists
  const relationshipsPath = path.join(newPath, '.metadata', 'relationships.json');
  if (fs.existsSync(relationshipsPath)) {
    try {
      const relContent = fs.readFileSync(relationshipsPath, 'utf-8');
      const relationships = JSON.parse(relContent);

      // Update any parent references that point to the old slug
      if (relationships.parent && relationships.parent.slug === oldSlug) {
        relationships.parent.slug = newSlug;
      }

      // Update evolved_from if it matches
      if (relationships.evolved_from === oldSlug) {
        relationships.evolved_from = newSlug;
      }

      // Update forked_from if it matches
      if (relationships.forked_from === oldSlug) {
        relationships.forked_from = newSlug;
      }

      // Update branched_from if it matches
      if (relationships.branched_from === oldSlug) {
        relationships.branched_from = newSlug;
      }

      // Update integrates_with array
      if (Array.isArray(relationships.integrates_with)) {
        relationships.integrates_with = relationships.integrates_with.map(
          (slug: string) => (slug === oldSlug ? newSlug : slug)
        );
      }

      // Write updated relationships
      fs.writeFileSync(relationshipsPath, JSON.stringify(relationships, null, 2), 'utf-8');
    } catch {
      // If we can't update relationships, continue
    }
  }

  // Update database references
  try {
    const { run, saveDb } = await import('../../database/db.js');

    // Update ideation_sessions
    await run(
      `UPDATE ideation_sessions SET idea_slug = ? WHERE user_slug = ? AND idea_slug = ?`,
      [newSlug, userSlug, oldSlug]
    );

    // Update ideation_artifacts
    await run(
      `UPDATE ideation_artifacts SET idea_slug = ? WHERE user_slug = ? AND idea_slug = ?`,
      [newSlug, userSlug, oldSlug]
    );

    // Save changes to disk
    await saveDb();
  } catch {
    // If database update fails, we continue - the files have been renamed
    // The caller should be aware that database might be out of sync
  }

  // Rebuild cache for the new folder
  await rebuildCache(userSlug, newSlug);
}
