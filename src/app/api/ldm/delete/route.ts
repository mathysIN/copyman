import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { serverDeleteContent } from "~/lib/serverUtils";
import r2Client from "~/server/r2";
import { env } from "~/env";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// Force dynamic rendering - this route uses request.url at runtime
export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  const host = req.headers.get("host") || "localhost";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contentId = searchParams.get("contentId");

    if (!contentId) {
      return NextResponse.redirect(`${getBaseUrl(req)}/?error=no_content_id`);
    }

    const session = await getSessionWithCookies(cookies());
    if (!session) {
      return NextResponse.redirect(`${getBaseUrl(req)}/?error=unauthorized`);
    }

    const content = await session.getContent(contentId);
    if (!content) {
      return NextResponse.redirect(
        `${getBaseUrl(req)}/?error=content_not_found`,
      );
    }

    if (content.type === "attachment") {
      const commandHeaders = {
        Bucket: env.R2_BUCKET_NAME,
        Key: content.fileKey,
      };
      const res = await r2Client.send(new HeadObjectCommand(commandHeaders));
      if (res.ContentLength) session.addUsedSpace(-res.ContentLength);
      await r2Client.send(new DeleteObjectCommand(commandHeaders));
    }

    await serverDeleteContent(session, contentId, undefined);

    return NextResponse.redirect(getBaseUrl(req));
  } catch (error) {
    console.error("LDM Delete error:", error);
    return NextResponse.redirect(`${getBaseUrl(req)}/?error=delete_failed`);
  }
}
