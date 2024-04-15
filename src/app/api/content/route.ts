import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionWithCookies } from "~/utils/authenticate";
import { utapi } from "~/server/uploadthing";

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
    utapi.deleteFiles(content.fileKey);
  }

  return NextResponse.json(content, { status: 200 });
}
