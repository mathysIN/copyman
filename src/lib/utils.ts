import crypto from "crypto";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type urlMetadata from "url-metadata";
import { ContentOrder, ContentType } from "~/server/db/redis";

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

export function sortAttachments(
  a: ContentType,
  b: ContentType,
  order: ContentOrder,
) {
  const indexA = order.indexOf(a.id);
  const indexB = order.indexOf(b.id);
  if (indexA != -1 && indexB != -1) return indexA - indexB;
  if (indexA == -1 && indexB == -1)
    return parseInt(b.createdAt) - parseInt(a.createdAt);
  if (indexA == -1) return -1;
  if (indexB == -1) return 1;
  return 0;
}
