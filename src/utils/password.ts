import { createHash, randomBytes } from "crypto";

/**
 * Derive a per-session salt from the session creation timestamp.
 * This ensures each session uses a unique salt for password hashing.
 * The salt is derived deterministically from the timestamp so it can
 * be recomputed on both client and server without storing the salt.
 */
export function deriveSaltFromTimestamp(createdAt: string): string {
  // Use PBKDF2-like approach: hash the timestamp multiple times
  const timestamp = createdAt.trim();
  let hash = createHash("sha256");
  hash.update(timestamp);
  let result = hash.digest();

  // Multiple iterations to make salt derivation more secure
  for (let i = 0; i < 1000; i++) {
    hash = createHash("sha256");
    hash.update(result);
    result = hash.digest();
  }

  // Return first 16 bytes as hex string (32 chars)
  return result.toString("hex").substring(0, 32);
}

/**
 * Hash a password using PBKDF2-like iterations with a per-session salt.
 * The salt is derived from the session's createdAt timestamp.
 * Returns a secure hash suitable for storage and comparison.
 */
export function hashPassword(password: string, createdAt: string): string {
  const salt = deriveSaltFromTimestamp(createdAt);

  // Initial hash: password + salt
  let hash = createHash("sha512");
  hash.update(password);
  hash.update(salt);
  let result = hash.digest();

  // PBKDF2-like iterations (100,000 iterations)
  for (let i = 0; i < 100000; i++) {
    hash = createHash("sha512");
    hash.update(result);
    hash.update(salt);
    hash.update(Buffer.from([i & 0xff, (i >> 8) & 0xff]));
    result = hash.digest();
  }

  return result.toString("hex");
}

/**
 * Validate a password against a stored hash.
 * The raw input password is hashed with the session's per-session salt
 * and compared against the stored hash.
 */
export function validatePassword(
  password: string,
  hashedPassword: string,
  createdAt: string,
): boolean {
  const computedHash = hashPassword(password, createdAt);
  // Use constant-time comparison to prevent timing attacks
  if (computedHash.length !== hashedPassword.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ hashedPassword.charCodeAt(i);
  }
  return result === 0;
}

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
