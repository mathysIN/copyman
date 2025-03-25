import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type urlMetadata from "url-metadata";
import { env } from "~/env";
import { Session } from "~/server/db/redis";
import r2Client, { getUrlFromFileR2FileKey } from "~/server/r2";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractLinksFromString(input: string): Set<string> {
  const regex = /(https?:\/\/[^\s]+)/g;
  const links = input.match(regex) ?? [];
  return new Set(links);
}

export type LinkMetadata = {
  title: string;
  description?: string;
};

export async function getLinkMetadata(
  url: string,
): Promise<LinkMetadata | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const title = doc.querySelector("title")?.textContent?.trim() ?? "";
    const description =
      doc.querySelector('meta[name="description"]')?.getAttribute("content") ??
      "";

    return { title, description };
  } catch (error) {
    return null;
  }
}

export async function getLinkMetadataFromClient(url: string) {
  return (await fetch(`/api/metadata?url=${url}`))
    .json()
    .catch(() => {}) as any as urlMetadata.Result | null;
}

export function areSetEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) {
    return false;
  }
  for (const elem of set1) {
    if (!set2.has(elem)) {
      return false;
    }
  }
  return true;
}

export function isValidSessionId(s: string): boolean {
  return s.length > 0 && /^[a-zA-Z0-9_]*$/.test(s);
}

export function deleteAllCookies() {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}

export function stringToHash(str: string) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return hash;
}

export function removeFileExtension(filename: string) {
  const parts = filename.split(".");
  parts.pop();
  return parts.join(".");
}

export function isImageURL(url: string): boolean {
  const extension = url.split(".").pop()?.toLowerCase();
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg"];
  if (extension && imageExtensions.includes(extension)) {
    return true;
  } else {
    return false;
  }
}

export async function createHashId(input: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

export async function convertFile(file: File) {
  const buffer = await file.arrayBuffer();
  return {
    file: Buffer.from(buffer).toString("base64"),
    fileName: file.name,
    mimeType: file.type,
  };
}

export async function serverCreateNote(session: Session, content: string) {
  const newNote = { content };
  return session.createNewNote(newNote);
}

export async function serverUploadFiles(session: Session, files: File[]) {
  return files.map(async (file) => {
    const startFileProcess = performance.now();
    const fileExtension = file.name.split(".").pop();

    const fileKey =
      crypto.randomBytes(16).toString("hex") + "." + fileExtension;
    const arrayBuffer = await file.arrayBuffer();
    const stream = Buffer.from(arrayBuffer);
    const fileUrl = getUrlFromFileR2FileKey(fileKey);
    const fileName = file.name;

    const startUpload = performance.now();
    await r2Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: stream,
        ContentType: file.type,
        ContentDisposition: `attachment; filename="${fileName}"`,
      }),
    );
    console.log(
      `Uploading file ${fileName} took: ${performance.now() - startUpload}ms`,
    );

    const startDbInsert = performance.now();
    const content = await session.createNewAttachment({
      attachmentPath: fileName,
      attachmentURL: fileUrl,
      fileKey: fileKey,
    });
    console.log(
      `DB insert for ${fileName} took: ${performance.now() - startDbInsert}ms`,
    );

    if (!content || content.type != "attachment")
      throw new Error("Failed to insert content");

    console.log(
      `Processing file ${fileName} took: ${performance.now() - startFileProcess}ms`,
    );
    return content;
  });
}
