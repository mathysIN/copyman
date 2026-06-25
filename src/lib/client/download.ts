"use client";
import JSZip from "jszip";
import { decryptFile } from "./encryption";
import type { AttachmentType } from "~/server/db/redis";

export async function downloadAttachmentsAsZip(
  items: AttachmentType[],
  encryptionKey?: CryptoKey | null,
  zipName = "download.zip",
): Promise<void> {
  if (items.length === 0) return;

  const zip = new JSZip();

  await Promise.all(
    items.map(async (item) => {
      try {
        const response = await fetch(item.attachmentURL);
        if (!response.ok) return;
        let blob = await response.blob();

        if (item.isEncrypted && encryptionKey && item.encryptedIv) {
          blob = await decryptFile(blob, item.encryptedIv, encryptionKey);
        }

        zip.file(item.attachmentPath, blob);
      } catch (e) {
        console.error("Failed to download file:", item.attachmentPath, e);
      }
    }),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
