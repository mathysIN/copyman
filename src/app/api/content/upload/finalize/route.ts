import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import r2Client from "~/server/r2";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { env } from "~/env";
import { socketSendAddContent } from "~/lib/socketInstance";
import { type AttachmentType } from "~/server/db/redis";
import { getUrlFromFileR2FileKey } from "~/server/r2";

export async function POST(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;

  let body: { files: { fileKey: string; fileName: string }[] };
  try {
    body = (await req.json()) as {
      files: { fileKey: string; fileName: string }[];
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const files = body?.files ?? [];
  if (!files.length)
    return NextResponse.json({ error: "No files provided" }, { status: 400 });

  // Verify uploaded objects and compute sizes
  const verified = await Promise.all(
    files.map(async (f) => {
      const head = await r2Client.send(
        new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: f.fileKey }),
      );
      const size = head.ContentLength ?? 0;
      return { ...f, size };
    }),
  );

  const totalSize = verified.reduce((s, f) => s + (f.size ?? 0), 0);

  const createdAttachments: AttachmentType[] = [];
  for (const f of verified) {
    const attachmentURL = getUrlFromFileR2FileKey(f.fileKey);
    const content = await session.createNewAttachment({
      attachmentPath: f.fileName,
      attachmentURL,
      fileKey: f.fileKey,
    });
    if (content && content.type === "attachment") {
      createdAttachments.push(content);
    }
  }

  await session.addUsedSpace(totalSize);
  socketSendAddContent(session, createdAttachments, socketUserId);

  return NextResponse.json(createdAttachments);
}
