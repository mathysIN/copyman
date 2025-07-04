import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionWithCookies } from "~/utils/authenticate";
import { utapi } from "~/server/uploadthing";
import r2Client from "~/server/r2";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { env } from "~/env";

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

  const response = await session.deleteContent(contentId);

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
