"use client";

import { useState, useCallback, useEffect } from "react";
import {
  isEncryptionSupported,
  generateKey,
  deriveKeyFromPassword,
  deriveSaltFromSessionId,
  encryptString,
  decryptString,
  encryptFile,
  decryptFile,
  exportKey,
  importKey,
  storeEncryptionKey,
  getStoredEncryptionKey,
  removeStoredEncryptionKey,
  parseEncryptionKeyFromUrl,
  getCookiePassword,
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

export function useEncryption(
  sessionId: string,
  sessionPassword?: string,
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
        "hasPassword:",
        !!sessionPassword,
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

      // Get password from props or cookie
      const effectivePassword = sessionPassword || getCookiePassword();
      console.log(
        "[E2EE Hook] Effective password available:",
        !!effectivePassword,
      );

      // If session is encrypted, derive key from password
      if (isSessionEncrypted && effectivePassword) {
        console.log(
          "[E2EE Hook] Session is encrypted, deriving key from password",
        );
        try {
          const salt = deriveSaltFromSessionId(sessionId);
          console.log(
            "[E2EE Hook] Derived salt from sessionId:",
            salt.substring(0, 10) + "...",
          );
          const encryptionKey = await deriveKeyFromPassword(
            effectivePassword,
            salt,
          );
          console.log("[E2EE Hook] Key derived from password successfully");
          setState({
            isSupported: true,
            isEnabled: true,
            isLoading: false,
            error: null,
            key: encryptionKey.key,
            isSessionEncrypted: true,
            needsPassword: false,
          });
          return;
        } catch (e) {
          console.error("[E2EE Hook] Failed to derive key from password:", e);
          setState((prev) => ({
            ...prev,
            isSupported: true,
            isLoading: false,
            error: "Failed to derive encryption key",
            isSessionEncrypted: true,
            needsPassword: true,
          }));
          return;
        }
      }

      // If session is encrypted but no password provided
      if (isSessionEncrypted && !sessionPassword) {
        console.log(
          "[E2EE Hook] Session is encrypted but no password provided",
        );
        // Check if we have a stored key (from previous session or URL share)
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

        setState((prev) => ({
          ...prev,
          isSupported: true,
          isLoading: false,
          isSessionEncrypted: true,
          needsPassword: true,
        }));
        return;
      }

      // Check for URL key (for non-password sessions)
      const urlKey = parseEncryptionKeyFromUrl();
      if (urlKey) {
        console.log("[E2EE Hook] Found key in URL");
        try {
          const key = await importKey(urlKey);
          const exportedKey = await exportKey(key);
          storeEncryptionKey(sessionId, exportedKey);
          console.log("[E2EE Hook] Key imported from URL and stored");
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
          console.error("[E2EE Hook] Failed to import key from URL:", e);
        }
      }

      // Check for stored key (for non-password sessions)
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
  }, [sessionId, sessionPassword, isSessionEncrypted]);

  const enableEncryption = useCallback(
    async (password?: string) => {
      console.log(
        "[E2EE Hook] enableEncryption called, password provided:",
        !!password,
      );
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        let encryptionKey: { key: CryptoKey; salt: string };
        if (password) {
          console.log(
            "[E2EE Hook] Deriving key from password with session salt",
          );
          const salt = deriveSaltFromSessionId(sessionId);
          encryptionKey = await deriveKeyFromPassword(password, salt);
        } else {
          console.log("[E2EE Hook] Generating random key");
          encryptionKey = await generateKey();
        }
        const exportedKey = await exportKey(encryptionKey.key);
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
          key: encryptionKey.key,
          isSessionEncrypted: true,
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
    [sessionId],
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
