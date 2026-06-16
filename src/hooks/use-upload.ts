"use client";

import { useState, useCallback, useRef } from "react";
import { uploadFiles as realUploadFile } from "~/lib/client/uploadFile";
import type { AttachmentType } from "~/server/db/redis";

export type UploadProgress = {
  id: string;
  progress: number;
  state: "active" | "error" | "done";
  erroredAt?: Date;
  finishedAt?: Date;
  filename: string;
};

export function useUpload(
  encryptionKey: CryptoKey | null,
  socketUserId: string | undefined,
  onUploadComplete: (attachments: AttachmentType[]) => void,
) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const encryptionKeyRef = useRef(encryptionKey);
  encryptionKeyRef.current = encryptionKey;

  const socketUserIdRef = useRef(socketUserId);
  socketUserIdRef.current = socketUserId;

  const onUploadCompleteRef = useRef(onUploadComplete);
  onUploadCompleteRef.current = onUploadComplete;

  const uploadFiles = useCallback(
    async (files: File[]): Promise<AttachmentType[] | null> => {
      if (files.length === 0) return [];

      const uploadId = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const firstFile = files[0];
      const label =
        files.length === 1 && firstFile
          ? firstFile.name
          : `${files.length} fichiers`;

      setUploadProgress((prev) => [
        ...prev,
        {
          id: uploadId,
          filename: label,
          progress: 0,
          state: "active",
        },
      ]);

      const uploadedFiles = await realUploadFile(
        files,
        (progress: number) => {
          setUploadProgress((prev) => {
            const next = [...prev];
            const index = next.findIndex((p) => p.id === uploadId);
            if (index === -1) return prev;
            const previous = next[index];
            if (!previous) return prev;

            if (progress >= 100 && !previous.finishedAt) {
              previous.finishedAt = new Date();
            }
            if (!previous.finishedAt) {
              previous.finishedAt = new Date();
            }
            next[index] = { ...previous, finishedAt: new Date(), progress };
            return next;
          });
        },
        socketUserIdRef.current,
        encryptionKeyRef.current,
      );

      setUploadProgress((prev) => prev.filter((p) => p.id !== uploadId));

      if (uploadedFiles) {
        onUploadCompleteRef.current(uploadedFiles);
      }

      return uploadedFiles;
    },
    [],
  );

  const uploadFilesToFolder = useCallback(
    async (files: File[], folderId: string) => {
      const uploadedFiles = await uploadFiles(files);
      if (!uploadedFiles || uploadedFiles.length === 0) return;

      for (const file of uploadedFiles) {
        await fetch(`/api/content/move`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Socket-User-Id": socketUserIdRef.current ?? "",
          },
          body: JSON.stringify({
            contentId: file.id,
            folderId,
          }),
        });
      }
    },
    [uploadFiles],
  );

  return {
    uploadFiles,
    uploadFilesToFolder,
    uploadProgress,
  };
}
