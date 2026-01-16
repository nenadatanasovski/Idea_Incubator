/**
 * URL Signer Utility (SEC-003)
 *
 * Provides HMAC-based URL signing for secure deep links.
 * Used for question answer links to prevent unauthorized access.
 */

import crypto from "crypto";

// Get signing secret from environment or generate a random one
const SIGNING_SECRET =
  process.env.URL_SIGNING_SECRET || crypto.randomBytes(32).toString("hex");

// Signature expiry time (24 hours by default)
const SIGNATURE_EXPIRY_MS = parseInt(
  process.env.URL_SIGNATURE_EXPIRY_MS || "86400000",
  10,
);

interface SignedUrlParams {
  questionId: string;
  value: string;
  expires?: number; // Unix timestamp
}

/**
 * Generate HMAC signature for URL parameters
 */
function generateSignature(params: SignedUrlParams): string {
  const data = `${params.questionId}:${params.value}:${params.expires || ""}`;
  return crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(data)
    .digest("hex")
    .substring(0, 16); // Use first 16 chars for shorter URLs
}

/**
 * Create a signed answer URL
 */
export function createSignedAnswerUrl(
  baseUrl: string,
  questionId: string,
  value: string,
  expiresInMs: number = SIGNATURE_EXPIRY_MS,
): string {
  const expires = Date.now() + expiresInMs;
  const signature = generateSignature({ questionId, value, expires });

  const params = new URLSearchParams({
    value: value,
    expires: expires.toString(),
    sig: signature,
  });

  return `${baseUrl}/api/questions/${questionId}/answer?${params.toString()}`;
}

/**
 * Validate a signed answer URL
 * Returns the value if valid, null if invalid
 */
export function validateSignedUrl(
  questionId: string,
  value: string,
  expires: string | undefined,
  signature: string | undefined,
): { valid: boolean; error?: string } {
  // Check if signature is present
  if (!signature) {
    return { valid: false, error: "Missing signature" };
  }

  // Check if expires is present and valid
  if (!expires) {
    return { valid: false, error: "Missing expiry" };
  }

  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum)) {
    return { valid: false, error: "Invalid expiry format" };
  }

  // Check if URL has expired
  if (Date.now() > expiresNum) {
    return { valid: false, error: "Link has expired" };
  }

  // Validate signature
  const expectedSignature = generateSignature({
    questionId,
    value,
    expires: expiresNum,
  });

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: "Invalid signature" };
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * Check if URL signing is enabled
 * Returns false if no secret is configured (allows unsigned URLs in dev)
 */
export function isSigningEnabled(): boolean {
  return !!process.env.URL_SIGNING_SECRET;
}

/**
 * Middleware helper to validate signed URLs
 * Can be used in Express routes
 */
export function validateAnswerRequest(
  questionId: string,
  query: { value?: string; expires?: string; sig?: string },
): { valid: boolean; value: string; error?: string } {
  const { value, expires, sig } = query;

  if (!value) {
    return { valid: false, value: "", error: "Missing value parameter" };
  }

  // If signing is not enabled, allow unsigned URLs (dev mode)
  if (!isSigningEnabled()) {
    console.warn("[URLSigner] Signing not enabled, allowing unsigned URL");
    return { valid: true, value };
  }

  const validation = validateSignedUrl(questionId, value, expires, sig);

  if (!validation.valid) {
    return { valid: false, value: "", error: validation.error };
  }

  return { valid: true, value };
}
