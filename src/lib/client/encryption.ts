"use client";

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

// Constants for key derivation from password
const AUTH_CONTEXT = "copyman-auth-v1";
const ENC_CONTEXT = "copyman-enc-v1";
const PASSWORD_PBKDF2_ITERATIONS = 100000;

/**
 * Build a unique salt by combining a context string with session creation timestamp.
 * This ensures keys are unique per session even with the same password.
 * @param context - "auth" or "enc" context string
 * @param createdAt - Session creation timestamp (from session.createdAt)
 * @returns Salt string for PBKDF2
 */
function buildSalt(context: string, createdAt: string): string {
  // Combine context with session creation timestamp for uniqueness
  return `${context}:${createdAt}`;
}

/**
 * Derive authentication key from password using PBKDF2.
 * This key is sent to the server for authentication (never the raw password).
 * @param password - The user's raw password
 * @param createdAt - Session creation timestamp (session.createdAt)
 * @returns Hex string of the derived auth key (256-bit)
 */
export async function deriveAuthKey(
  password: string,
  createdAt: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = buildSalt(AUTH_CONTEXT, createdAt);
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PASSWORD_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return arrayBufferToHex(derivedBits);
}

/**
 * Derive encryption key from password using PBKDF2.
 * This key is used for E2EE and NEVER sent to the server.
 * @param password - The user's raw password
 * @param createdAt - Session creation timestamp (session.createdAt)
 * @returns CryptoKey for AES-GCM encryption/decryption
 */
export async function deriveEncKey(
  password: string,
  createdAt: string,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = buildSalt(ENC_CONTEXT, createdAt);
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PASSWORD_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Derive both auth and encryption keys from a single password.
 * This is the main function to use when user enters their password.
 * @param password - The user's raw password
 * @param createdAt - Session creation timestamp (session.createdAt)
 * @returns Object containing authKey (string) and encKey (CryptoKey)
 */
export async function deriveKeysFromPassword(
  password: string,
  createdAt: string,
): Promise<{
  authKey: string;
  encKey: CryptoKey;
}> {
  const [authKey, encKey] = await Promise.all([
    deriveAuthKey(password, createdAt),
    deriveEncKey(password, createdAt),
  ]);

  return { authKey, encKey };
}

/**
 * Helper function to convert ArrayBuffer to hex string.
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type EncryptedData = {
  ciphertext: string;
  iv: string;
  salt: string;
};

export type EncryptionKey = {
  key: CryptoKey;
  salt: string;
};

export function isEncryptionSupported(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle;
}

export async function generateKey(): Promise<EncryptionKey> {
  const salt = generateSalt();
  const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
  const key = await window.crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: ALGORITHM },
    true,
    ["encrypt", "decrypt"],
  );
  return { key, salt };
}

/**
 * Derive an encryption key from a password using PBKDF2.
 * The salt should be derived from the session ID for consistent key derivation.
 */
export async function deriveKeyFromPassword(
  password: string,
  salt?: string,
): Promise<EncryptionKey> {
  const actualSalt = salt || generateSalt();
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"],
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(actualSalt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );

  return { key, salt: actualSalt };
}

/**
 * Derive a salt from the session ID for PBKDF2 key derivation.
 * This ensures the same password + session always generates the same key.
 * The salt is derived deterministically from the sessionId.
 */
export function deriveSaltFromSessionId(sessionId: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(sessionId);

  // Create a deterministic salt from the session ID
  // This ensures the same session always uses the same salt for key derivation
  const hashArray = new Uint8Array(SALT_LENGTH);
  for (let i = 0; i < SALT_LENGTH; i++) {
    // Mix multiple bytes of the session ID with position-based variation
    const byte1 = data[i % data.length] || 0;
    const byte2 = data[(i * 7) % data.length] || 0;
    const byte3 = data[(i * 13) % data.length] || 0;

    // XOR and mix bits to create more variation
    hashArray[i] = (byte1 ^ byte2 ^ byte3 ^ (i * 17)) % 256;
  }

  return arrayBufferToBase64(hashArray);
}

export function generateSalt(): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return arrayBufferToBase64(salt);
}

export function generateIV(): string {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  return arrayBufferToBase64(iv);
}

export async function encryptString(
  plaintext: string,
  encryptionKey: CryptoKey,
): Promise<EncryptedData> {
  console.log("[E2EE] encryptString: input length =", plaintext.length);
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    encryptionKey,
    encoder.encode(plaintext),
  );

  const result = {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    salt: generateSalt(),
  };
  console.log(
    "[E2EE] encryptString: output ciphertext length =",
    result.ciphertext.length,
  );
  return result;
}

export async function decryptString(
  encryptedData: EncryptedData,
  encryptionKey: CryptoKey,
): Promise<string> {
  console.log(
    "[E2EE] decryptString: input ciphertext length =",
    encryptedData.ciphertext.length,
  );
  const decoder = new TextDecoder();
  const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
  const iv = base64ToArrayBuffer(encryptedData.iv);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    encryptionKey,
    ciphertext,
  );

  const result = decoder.decode(decrypted);
  console.log("[E2EE] decryptString: output length =", result.length);
  return result;
}

export async function encryptFile(
  file: File,
  encryptionKey: CryptoKey,
): Promise<{ encryptedData: Blob; iv: string; salt: string }> {
  console.log(
    "[E2EE] encryptFile: input file =",
    file.name,
    "size =",
    file.size,
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const fileBuffer = await file.arrayBuffer();

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    encryptionKey,
    fileBuffer,
  );

  const result = {
    encryptedData: new Blob([ciphertext], { type: "application/octet-stream" }),
    iv: arrayBufferToBase64(iv),
    salt: generateSalt(),
  };
  console.log(
    "[E2EE] encryptFile: output blob size =",
    result.encryptedData.size,
  );
  return result;
}

export async function decryptFile(
  encryptedBlob: Blob,
  iv: string,
  encryptionKey: CryptoKey,
): Promise<Blob> {
  console.log("[E2EE] decryptFile: input blob size =", encryptedBlob.size);
  const ivBuffer = base64ToArrayBuffer(iv);
  const encryptedBuffer = await encryptedBlob.arrayBuffer();

  const decrypted = await window.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer },
    encryptionKey,
    encryptedBuffer,
  );

  const result = new Blob([decrypted]);
  console.log("[E2EE] decryptFile: output blob size =", result.size);
  return result;
}

export async function exportKey(encryptionKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", encryptionKey);
  return arrayBufferToBase64(exported);
}

export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(keyString);
  return window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM },
    true,
    ["encrypt", "decrypt"],
  );
}

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeEncryptedData(data: EncryptedData): string {
  return JSON.stringify(data);
}

export function decodeEncryptedData(encoded: string): EncryptedData | null {
  try {
    return JSON.parse(encoded) as EncryptedData;
  } catch {
    return null;
  }
}

const ENCRYPTION_KEY_STORAGE_KEY = "copyman_encryption_key";

export function storeEncryptionKey(sessionId: string, keyString: string): void {
  const keys = getAllStoredKeys();
  keys[sessionId] = keyString;
  localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, JSON.stringify(keys));
}

export function getStoredEncryptionKey(sessionId: string): string | null {
  const keys = getAllStoredKeys();
  return keys[sessionId] || null;
}

export function removeStoredEncryptionKey(sessionId: string): void {
  const keys = getAllStoredKeys();
  delete keys[sessionId];
  localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, JSON.stringify(keys));
}

function getAllStoredKeys(): Record<string, string> {
  try {
    const stored = localStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Generate a random encryption key for sharing (for non-password-based encryption).
 * @deprecated Use password-based E2EE instead for better security.
 */
export function generateEncryptionKeyForSharing(): string {
  const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(rawKey);
}
