import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { serverDeleteContent } from "~/lib/serverUtils";
import r2Client from "~/server/r2";
import { env } from "~/env";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const contentId = searchParams.get("contentId");

    if (!contentId) {
      return NextResponse.redirect(
        new URL("/ldm?error=no_content_id", req.url),
      );
    }

    const session = await getSessionWithCookies(cookies());
    if (!session) {
      return NextResponse.redirect(new URL("/ldm?error=unauthorized", req.url));
    }

    const content = await session.getContent(contentId);
    if (!content) {
      return NextResponse.redirect(
        new URL("/ldm?error=content_not_found", req.url),
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

    return NextResponse.redirect(new URL("/ldm", req.url));
  } catch (error) {
    console.error("LDM Delete error:", error);
    return NextResponse.redirect(new URL("/ldm?error=delete_failed", req.url));
  }
}
