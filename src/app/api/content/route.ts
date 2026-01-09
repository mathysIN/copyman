import { cookies } from "next/headers";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSessionWithCookies } from "~/utils/authenticate";
import { utapi } from "~/server/uploadthing";
import r2Client from "~/server/r2";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "~/env";
import { serverDeleteContent, serverRenameFile } from "~/lib/serverUtils";
import contentDisposition from "content-disposition";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const orderAttachment = await session.getContentOrder();
  const sessionContent = (await session.getAllContent()).sort((a, b) => {
    if (a.type === "attachment" && b.type !== "attachment") return 1;
    if (a.type !== "attachment" && b.type === "attachment") return -1;
    return orderAttachment.indexOf(a.id) - orderAttachment.indexOf(b.id);
  });
  return NextResponse.json(sessionContent, { status: 200 });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await getSessionWithCookies(cookies());
  const socketUserId = request.headers.get("X-Socket-User-Id") ?? undefined;
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const contentId = searchParams.get("contentId")?.toString();

  if (!contentId)
    return NextResponse.json(
      { message: "contentId is required" },
      { status: 400 },
    );

  const content = await session.getContent(contentId);

  if (!content)
    return NextResponse.json({ message: "Content not found" }, { status: 404 });

  const response = await serverDeleteContent(session, contentId, socketUserId);

  if (!response)
    return NextResponse.json(
      { message: "Failed to delete content" },
      { status: 500 },
    );

  if (content.type === "attachment") {
    const commandHeaders = {
      Bucket: env.R2_BUCKET_NAME,
      Key: content.fileKey,
    };
    const res = await r2Client.send(new HeadObjectCommand(commandHeaders));
    if (res.ContentLength) session.addUsedSpace(-res.ContentLength);
    await r2Client.send(new DeleteObjectCommand(commandHeaders));
  }

  return NextResponse.json(content, { status: 200 });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const session = await getSessionWithCookies(cookies());
  const socketUserId = request.headers.get("X-Socket-User-Id") ?? undefined;
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const contentId = searchParams.get("contentId")?.toString();
  const newFileName = searchParams.get("fileName")?.toString();

  if (!contentId)
    return NextResponse.json(
      { message: "contentId is required" },
      { status: 400 },
    );

  if (!newFileName)
    return NextResponse.json(
      { message: "fileName is required" },
      { status: 400 },
    );

  const oldContent = await session.getContent(contentId);

  if (!oldContent)
    return NextResponse.json({ message: "Content not found" }, { status: 404 });

  if (oldContent.type != "attachment")
    return NextResponse.json(
      { message: "Content is not a attachment" },
      { status: 404 },
    );

  const response = await serverRenameFile(
    session,
    contentId,
    newFileName,
    socketUserId,
  );

  if (!response)
    return NextResponse.json(
      { message: "Failed to delete content" },
      { status: 500 },
    );

  return NextResponse.json(oldContent, { status: 200 });
}
