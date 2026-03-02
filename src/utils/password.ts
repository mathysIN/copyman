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
 * @param authKey - The derived authentication key from client
 * @param storedHash - The stored hash from database
 * @returns True if the auth key matches
 */
export function verifyAuthKey(authKey: string, storedHash: string): boolean {
  const computedHash = hashAuthKey(authKey);
  // Constant-time comparison
  if (computedHash.length !== storedHash.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

// LEGACY FUNCTIONS - Used by Session class for password change/verify
// These will be removed in a future cleanup

/**
 * @deprecated Only used internally by Session class. Use authKey system instead.
 */
export function hashPassword(password: string, createdAt: string): string {
  const salt = createdAt;
  let hash = createHash("sha512");
  hash.update(password);
  hash.update(salt);
  let result = hash.digest();

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
 * @deprecated Only used internally by Session class. Use authKey system instead.
 */
export function validatePassword(
  password: string,
  hashedPassword: string,
  createdAt: string,
): boolean {
  const computedHash = hashPassword(password, createdAt);
  if (computedHash.length !== hashedPassword.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ hashedPassword.charCodeAt(i);
  }
  return result === 0;
}
