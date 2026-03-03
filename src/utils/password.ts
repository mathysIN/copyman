import { createHash, randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random session token.
 * This is used for session authentication instead of storing password hashes in cookies.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a session token for storage in the database.
 * We store the hash, not the raw token, so even if the DB is compromised,
 * attackers can't use stolen tokens.
 */
export function hashSessionToken(token: string): string {
  const hash = createHash("sha256");
  hash.update(token);
  return hash.digest("hex");
}

/**
 * Hash an authentication key for storage.
 * Auth keys are already derived from passwords client-side using PBKDF2,
 * so we only need a single SHA-256 hash for storage.
 * @param authKey - The derived authentication key (hex string)
 * @returns SHA-256 hash of the auth key (64 characters)
 */
export function hashAuthKey(authKey: string): string {
  const hash = createHash("sha256");
  hash.update(authKey);
  return hash.digest("hex");
}

/**
 * Verify an authentication key against a stored hash.
 * Only supports new format (64-char SHA256).
 * Legacy sessions (128-char SHA512) are NOT supported.
 * @param authKey - The derived authentication key from client
 * @param storedHash - The stored hash from database (must be 64 chars)
 * @returns True if the auth key matches
 */
export function verifyAuthKey(authKey: string, storedHash: string): boolean {
  if (storedHash.length !== 64) {
    // Legacy format not supported
    return false;
  }
  const computedHash = hashAuthKey(authKey);
  return constantTimeCompare(computedHash, storedHash);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
