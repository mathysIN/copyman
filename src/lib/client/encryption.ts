"use client";

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

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

export function deriveSaltFromSessionId(sessionId: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(sessionId);
  const hashArray = new Uint8Array(SALT_LENGTH);
  for (let i = 0; i < SALT_LENGTH; i++) {
    const charCode = data[i % data.length];
    if (charCode !== undefined) {
      hashArray[i] = charCode ^ (i * 17) % 256;
    }
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

export function generateEncryptionKeyForSharing(): string {
  const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(rawKey);
}

export function parseEncryptionKeyFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (hash.startsWith("#key=")) {
    return hash.substring(5);
  }
  return null;
}

export function buildUrlWithEncryptionKey(
  baseUrl: string,
  keyString: string,
): string {
  return `${baseUrl}#key=${keyString}`;
}

export function getCookiePassword(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "password" && value) {
      return decodeURIComponent(value);
    }
  }
  return null;
}
