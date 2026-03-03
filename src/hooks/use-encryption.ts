"use client";

import { useState, useCallback, useEffect } from "react";
import {
  isEncryptionSupported,
  generateKey,
  deriveKeyFromPassword,
  deriveSaltFromSessionId,
  deriveAuthKey,
  deriveEncKey,
  encryptString,
  decryptString,
  encryptFile,
  decryptFile,
  exportKey,
  importKey,
  storeEncryptionKey,
  getStoredEncryptionKey,
  removeStoredEncryptionKey,
  type EncryptedData,
} from "~/lib/client/encryption";
import type { NoteType, AttachmentType } from "~/server/db/redis";

export type EncryptionState = {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  key: CryptoKey | null;
  isSessionEncrypted: boolean;
  needsPassword: boolean;
};

/**
 * Verify an auth key with the server before enabling E2EE.
 * Client derives authKey from password + session creation timestamp.
 * Server verifies authKey against stored hash without seeing raw password.
 */
async function verifyAuthKeyWithServer(
  sessionId: string,
  password: string,
  createdAt: string,
): Promise<boolean> {
  try {
    // Derive authKey from password + session creation timestamp
    const authKey = await deriveAuthKey(password, createdAt);

    const response = await fetch(
      `/api/sessions/verify-password?sessionId=${sessionId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authKey }),
      },
    );
    const result = await response.json();
    return result.valid === true;
  } catch (e) {
    console.error("[E2EE] Failed to verify auth key with server:", e);
    return false;
  }
}

/**
 * Get the encryption key stored in sessionStorage for E2EE auto-enable.
 * This is set during the join flow and cleared after use.
 */
function getStoredJoinKey(sessionId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const key = `e2ee_key_${sessionId.toLowerCase()}`;
  const encryptionKey = sessionStorage.getItem(key);
  // Clear immediately after retrieval for security
  if (encryptionKey) {
    sessionStorage.removeItem(key);
  }
  return encryptionKey;
}

export function useEncryption(
  sessionId: string,
  _sessionPassword?: string, // Deprecated - no longer used
  isSessionEncrypted?: boolean,
) {
  const [state, setState] = useState<EncryptionState>({
    isSupported: false,
    isEnabled: false,
    isLoading: true,
    error: null,
    key: null,
    isSessionEncrypted: isSessionEncrypted ?? false,
    needsPassword: false,
  });

  useEffect(() => {
    const init = async () => {
      console.log(
        "[E2EE Hook] Initializing for session:",
        sessionId,
        "isEncrypted:",
        isSessionEncrypted,
      );

      if (!isEncryptionSupported()) {
        console.log("[E2EE Hook] Encryption not supported");
        setState((prev) => ({
          ...prev,
          isSupported: false,
          isLoading: false,
        }));
        return;
      }

      // If session is encrypted, check for stored encryption key from join flow
      if (isSessionEncrypted) {
        console.log(
          "[E2EE Hook] Session is encrypted, checking for stored key",
        );

        // Check sessionStorage for encryption key from join flow
        const joinKey = getStoredJoinKey(sessionId);

        if (joinKey) {
          console.log("[E2EE Hook] Found stored encryption key from join flow");
          try {
            const key = await importKey(joinKey);
            console.log("[E2EE Hook] Key imported successfully");

            // Store the key for persistence
            storeEncryptionKey(sessionId, joinKey);

            setState({
              isSupported: true,
              isEnabled: true,
              isLoading: false,
              error: null,
              key,
              isSessionEncrypted: true,
              needsPassword: false,
            });
            return;
          } catch (e) {
            console.error("[E2EE Hook] Failed to import stored key:", e);
            setState((prev) => ({
              ...prev,
              isSupported: true,
              isLoading: false,
              error: "Failed to import encryption key",
              isSessionEncrypted: true,
              needsPassword: true,
            }));
            return;
          }
        }

        // Check if we have a stored key from previous session
        const storedKey = getStoredEncryptionKey(sessionId);
        if (storedKey) {
          try {
            const key = await importKey(storedKey);
            console.log(
              "[E2EE Hook] Key loaded from storage for encrypted session",
            );
            setState({
              isSupported: true,
              isEnabled: true,
              isLoading: false,
              error: null,
              key,
              isSessionEncrypted: true,
              needsPassword: false,
            });
            return;
          } catch (e) {
            console.error("[E2EE Hook] Failed to import stored key:", e);
            removeStoredEncryptionKey(sessionId);
          }
        }

        // No key available - need password to derive it
        console.log("[E2EE Hook] Session is encrypted but no key available");
        setState((prev) => ({
          ...prev,
          isSupported: true,
          isLoading: false,
          isSessionEncrypted: true,
          needsPassword: true,
        }));
        return;
      }

      // Non-encrypted session - check for stored key
      const storedKey = getStoredEncryptionKey(sessionId);
      if (storedKey) {
        console.log("[E2EE Hook] Found stored key for session");
        try {
          const key = await importKey(storedKey);
          console.log("[E2EE Hook] Key loaded from storage");
          setState({
            isSupported: true,
            isEnabled: true,
            isLoading: false,
            error: null,
            key,
            isSessionEncrypted: false,
            needsPassword: false,
          });
          return;
        } catch (e) {
          console.error("[E2EE Hook] Failed to import stored key:", e);
          removeStoredEncryptionKey(sessionId);
        }
      }

      console.log("[E2EE Hook] No encryption key found, encryption disabled");
      setState((prev) => ({
        ...prev,
        isSupported: true,
        isLoading: false,
        isSessionEncrypted: false,
        needsPassword: false,
      }));
    };

    init();
  }, [sessionId, isSessionEncrypted]);

  const enableEncryption = useCallback(
    async (password?: string, createdAt?: string) => {
      console.log(
        "[E2EE Hook] enableEncryption called, password provided:",
        !!password,
      );
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        let encryptionKey: CryptoKey;

        if (password && createdAt) {
          console.log(
            "[E2EE Hook] Deriving key from password with session createdAt",
          );

          // Verify auth key with server first (for E2EE sessions)
          if (state.isSessionEncrypted) {
            const isValid = await verifyAuthKeyWithServer(
              sessionId,
              password,
              createdAt,
            );
            if (!isValid) {
              console.error("[E2EE Hook] Auth key verification failed");
              setState((prev) => ({
                ...prev,
                isLoading: false,
                error: "Invalid password",
                needsPassword: true,
              }));
              return null;
            }
            console.log("[E2EE Hook] Auth key verified with server");
          }

          encryptionKey = await deriveEncKey(password, createdAt);
        } else if (password) {
          console.error("[E2EE Hook] Password provided but no createdAt");
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Session information required",
            needsPassword: true,
          }));
          return null;
        } else {
          console.log("[E2EE Hook] Generating random key");
          const keyResult = await generateKey();
          encryptionKey = keyResult.key;
        }

        const exportedKey = await exportKey(encryptionKey);
        storeEncryptionKey(sessionId, exportedKey);
        console.log(
          "[E2EE Hook] Key stored, key preview:",
          exportedKey.substring(0, 20) + "...",
        );

        setState({
          isSupported: true,
          isEnabled: true,
          isLoading: false,
          error: null,
          key: encryptionKey,
          isSessionEncrypted: password ? true : state.isSessionEncrypted,
          needsPassword: false,
        });
        return exportedKey;
      } catch (e) {
        console.error("[E2EE Hook] Failed to enable encryption:", e);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to enable encryption",
        }));
        return null;
      }
    },
    [sessionId, state.isSessionEncrypted],
  );

  const disableEncryption = useCallback(() => {
    console.log("[E2EE Hook] disableEncryption called");
    removeStoredEncryptionKey(sessionId);
    setState((prev) => ({
      ...prev,
      isEnabled: false,
      key: null,
    }));
  }, [sessionId]);

  const encryptNoteContent = useCallback(
    async (
      content: string,
    ): Promise<{
      content: string;
      isEncrypted: boolean;
      encryptedIv: string;
      encryptedSalt: string;
    }> => {
      console.log(
        "[E2EE Hook] encryptNoteContent called, content length:",
        content.length,
      );
      if (!state.key) {
        console.error("[E2EE Hook] encryptNoteContent: no key available");
        throw new Error("Encryption not enabled");
      }
      const encrypted = await encryptString(content, state.key);
      console.log(
        "[E2EE Hook] Note encrypted, iv:",
        encrypted.iv.substring(0, 10) + "...",
      );
      return {
        content: encrypted.ciphertext,
        isEncrypted: true,
        encryptedIv: encrypted.iv,
        encryptedSalt: encrypted.salt,
      };
    },
    [state.key],
  );

  const decryptNoteContent = useCallback(
    async (note: NoteType): Promise<string> => {
      console.log(
        "[E2EE Hook] decryptNoteContent called, note id:",
        note.id,
        "isEncrypted:",
        note.isEncrypted,
      );
      if (!state.key) {
        console.error("[E2EE Hook] decryptNoteContent: no key available");
        throw new Error("Encryption not enabled");
      }
      if (!note.isEncrypted || !note.encryptedIv) {
        console.log("[E2EE Hook] Note not encrypted, returning raw content");
        return note.content;
      }
      const encryptedData: EncryptedData = {
        ciphertext: note.content,
        iv: note.encryptedIv,
        salt: note.encryptedSalt || "",
      };
      console.log(
        "[E2EE Hook] Decrypting note content, ciphertext length:",
        note.content.length,
      );
      const decrypted = await decryptString(encryptedData, state.key);
      console.log(
        "[E2EE Hook] Note decrypted, content length:",
        decrypted.length,
      );
      return decrypted;
    },
    [state.key],
  );

  const encryptAttachment = useCallback(
    async (
      file: File,
    ): Promise<{
      encryptedFile: Blob;
      iv: string;
      salt: string;
    }> => {
      if (!state.key) {
        throw new Error("Encryption not enabled");
      }
      const result = await encryptFile(file, state.key);
      return {
        encryptedFile: result.encryptedData,
        iv: result.iv,
        salt: result.salt,
      };
    },
    [state.key],
  );

  const decryptAttachment = useCallback(
    async (blob: Blob, iv: string): Promise<Blob> => {
      if (!state.key) {
        throw new Error("Encryption not enabled");
      }
      return decryptFile(blob, iv, state.key);
    },
    [state.key],
  );

  const getShareableKey = useCallback(async (): Promise<string | null> => {
    if (!state.key) return null;
    return exportKey(state.key);
  }, [state.key]);

  return {
    ...state,
    enableEncryption,
    disableEncryption,
    encryptNoteContent,
    decryptNoteContent,
    encryptAttachment,
    decryptAttachment,
    getShareableKey,
  };
}

export function useEncryptedNote(
  note: NoteType,
  sessionId: string,
  onUpdate?: (note: NoteType) => void,
) {
  const encryption = useEncryption(sessionId);
  const [decryptedContent, setDecryptedContent] = useState<string>(
    note.content,
  );
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    const decrypt = async () => {
      if (!note.isEncrypted || !encryption.isEnabled || !encryption.key) {
        setDecryptedContent(note.content);
        return;
      }
      setIsDecrypting(true);
      try {
        const decrypted = await encryption.decryptNoteContent(note);
        setDecryptedContent(decrypted);
      } catch (e) {
        console.error("Failed to decrypt note:", e);
        setDecryptedContent("[Encrypted content - unable to decrypt]");
      }
      setIsDecrypting(false);
    };
    decrypt();
  }, [
    note,
    encryption.isEnabled,
    encryption.key,
    encryption.decryptNoteContent,
  ]);

  const updateContent = useCallback(
    async (newContent: string) => {
      if (!encryption.isEnabled || !encryption.key) {
        onUpdate?.({ ...note, content: newContent });
        return;
      }
      try {
        const encrypted = await encryption.encryptNoteContent(newContent);
        onUpdate?.({
          ...note,
          content: encrypted.content,
          isEncrypted: encrypted.isEncrypted,
          encryptedIv: encrypted.encryptedIv,
          encryptedSalt: encrypted.encryptedSalt,
        });
      } catch (e) {
        console.error("Failed to encrypt note:", e);
      }
    },
    [note, encryption, onUpdate],
  );

  return {
    decryptedContent,
    isDecrypting,
    updateContent,
    isEncrypted: note.isEncrypted ?? false,
    encryption,
  };
}

export function useEncryptedAttachment(
  attachment: AttachmentType,
  sessionId: string,
) {
  const encryption = useEncryption(sessionId);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);

  const downloadAndDecrypt = useCallback(async () => {
    if (!attachment.isEncrypted || !encryption.isEnabled || !encryption.key) {
      const response = await fetch(attachment.attachmentURL);
      return response.blob();
    }
    setIsDecrypting(true);
    try {
      const response = await fetch(attachment.attachmentURL);
      const encryptedBlob = await response.blob();
      const decrypted = await encryption.decryptAttachment(
        encryptedBlob,
        attachment.encryptedIv || "",
      );
      setDecryptedBlob(decrypted);
      setIsDecrypting(false);
      return decrypted;
    } catch (e) {
      console.error("Failed to decrypt attachment:", e);
      setIsDecrypting(false);
      throw e;
    }
  }, [attachment, encryption]);

  const getDownloadUrl = useCallback(async (): Promise<string> => {
    const blob = await downloadAndDecrypt();
    return URL.createObjectURL(blob);
  }, [downloadAndDecrypt]);

  return {
    isDecrypting,
    decryptedBlob,
    downloadAndDecrypt,
    getDownloadUrl,
    isEncrypted: attachment.isEncrypted ?? false,
    encryption,
  };
}
