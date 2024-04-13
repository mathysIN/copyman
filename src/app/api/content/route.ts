import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { contents } from "~/server/db/schema";
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

  const response = await db
    .delete(contents)
    .where(eq(contents.id, parseInt(contentId)))
    .returning();

  if (!response[0])
    return NextResponse.json(
      { message: "Failed to delete content" },
      { status: 500 },
    );

  utapi.deleteFiles([response[0].fileKey]);

  return NextResponse.json(response[0], { status: 200 });
}
