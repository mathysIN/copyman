import { NextResponse } from "next/server";
import urlMetadata from "url-metadata";
import ExpiryMap from "expiry-map";

type MetadataParams = {
  url?: string;
};

const cachedMetadata = new ExpiryMap<string, urlMetadata.Result>(
  1000 * 60 * 10,
);

// FIXME: This shit really needs ratelimiting
export async function GET(req: Request, context: { params: MetadataParams }) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url)
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  let metadata;
  if (cachedMetadata.has(url)) {
    metadata = cachedMetadata.get(url);
  } else {
    metadata = await urlMetadata(url).catch(() => {});
    if (metadata) cachedMetadata.set(url, metadata);
  }
  if (!metadata) {
    return NextResponse.json(
      { message: "failed to get metadata" },
      { status: 500 },
    );
  }
  return NextResponse.json(metadata);
}
