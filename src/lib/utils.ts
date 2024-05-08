import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type urlMetadata from "url-metadata";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractLinksFromString(input: string): string[] {
  const regex = /(https?:\/\/[^\s]+)/g;
  const links = input.match(regex);
  return links ?? [];
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
