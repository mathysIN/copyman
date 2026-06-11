import { NextResponse } from "next/server";
import urlMetadata from "url-metadata";
import ExpiryMap from "expiry-map";

const MAX_SIZE_BYTES = 1024 * 1024; // 1MB max
const TIMEOUT_MS = 5000; // 5 second timeout

const cachedMetadata = new ExpiryMap<string, urlMetadata.Result>(
  1000 * 60 * 10,
);

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  }

  // Check cache first
  if (cachedMetadata.has(url)) {
    return NextResponse.json(cachedMetadata.get(url));
  }

  try {
    // Step 1: HEAD request to check headers before downloading
    const headResponse = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Copyman/1.0 (metadata fetcher)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!headResponse.ok) {
      return NextResponse.json(
        { message: "failed to fetch url" },
        { status: 500 },
      );
    }

    const contentType = headResponse.headers.get("content-type") || "";
    const contentLength = headResponse.headers.get("content-length");

    // Step 2: Validate content type (must be HTML)
    if (!contentType.includes("text/html")) {
      return NextResponse.json(
        { message: "unsupported content type" },
        { status: 400 },
      );
    }

    // Step 3: Validate content size
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { message: "content too large" },
          { status: 400 },
        );
      }
    }

    // Step 4: Fetch metadata with timeout
    const metadata = await urlMetadata(url, {
      timeout: TIMEOUT_MS,
      requestHeaders: {
        "User-Agent": "Copyman/1.0 (metadata fetcher)",
      },
    });

    if (metadata) {
      cachedMetadata.set(url, metadata);
      return NextResponse.json(metadata);
    }

    return NextResponse.json(
      { message: "failed to get metadata" },
      { status: 500 },
    );
  } catch (error) {
    console.error("[METADATA] Error fetching metadata:", error);
    return NextResponse.json(
      { message: "failed to get metadata" },
      { status: 500 },
    );
  }
}
