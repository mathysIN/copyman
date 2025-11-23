import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import r2Client, { getUrlFromFileR2FileKey } from "~/server/r2";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { env } from "~/env";
import { type AttachmentType } from "~/server/db/redis";
import { socketSendAddContent } from "~/lib/socketInstance";

type FinalizeRequest = {
  key: string;
  name: string;
  type: string;
  socketId?: string;
};

export async function POST(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: FinalizeRequest | null = null;
  try {
    body = (await req.json()) as FinalizeRequest;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.key || !body?.name) {
    return NextResponse.json(
      { message: "Missing key or name" },
      { status: 400 },
    );
  }

  // Verify object exists and get size
  const head = await r2Client.send(
    new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: body.key }),
  );
  const size = head.ContentLength || 0;

  const url = getUrlFromFileR2FileKey(body.key);
  const content = await session.createNewAttachment({
    attachmentPath: body.name,
    attachmentURL: url,
    fileKey: body.key,
  });
  if (!content || content.type !== "attachment")
    return NextResponse.json(
      { message: "Failed to insert content" },
      { status: 500 },
    );

  if (size > 0) session.addUsedSpace(size);
  socketSendAddContent(session, [content], body?.socketId);

  return NextResponse.json(content as AttachmentType);
}

