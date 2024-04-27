import { NextResponse } from "next/server";
import { getLinkMetadata } from "~/lib/utils";
import urlMetadata from "url-metadata";

type MetadataParams = {
  url?: string;
};

export async function GET(req: Request, context: { params: MetadataParams }) {
  // const url = context.params?.url; // ??
  const url = new URL(req.url).searchParams.get("url");
  if (!url)
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  const metadata = await urlMetadata(url);
  return NextResponse.json(metadata);
}
