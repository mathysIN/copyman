import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUrlFromFileR2FileKey } from "~/server/r2";
import { getSessionWithCookies } from "~/utils/authenticate";

export async function GET(
  request: Request,
  { params }: { params: { fileid?: string } },
) {
  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const fileId = params.fileid;
  if (!fileId) {
    return NextResponse.json(
      { error: "Missing file parameters" },
      { status: 400 },
    );
  }
  const content = await session.getContent(fileId);
  if (!content) {
    return NextResponse.json({ message: "Content not found" }, { status: 404 });
  }

  if (content.type !== "attachment") {
    return NextResponse.json(
      { message: "Content is not an attachment" },
      { status: 400 },
    );
  }

  const fileUrl = getUrlFromFileR2FileKey(content.fileKey);

  const response = await fetch(fileUrl);
  if (!response.ok) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileBuffer = await response.arrayBuffer();

  return new NextResponse(Buffer.from(fileBuffer), {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${content.attachmentPath}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
