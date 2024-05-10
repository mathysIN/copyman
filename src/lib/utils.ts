import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type urlMetadata from "url-metadata";

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
  return /^[a-zA-Z0-9_]*$/.test(s);
}

export function deleteAllCookies() {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}
