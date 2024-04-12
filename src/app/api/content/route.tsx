import { put, del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { contents } from "~/server/db/schema";
import { getSessionWithCookies } from "~/utils/authenticate";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename")?.toString();

  if (!filename) return NextResponse.json({ message: "bruh" }, { status: 400 });

  const blob = await put(filename, await request.blob(), {
    access: "public",
  });

  const response = await db
    .insert(contents)
    .values({
      pathname: filename,
      sessionId: session.id,
      contentURL: blob.url,
    })
    .returning();

  return NextResponse.json(response[0], { status: 200 });
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

  const response = await db
    .delete(contents)
    .where(eq(contents.id, parseInt(contentId)))
    .returning();

  if (response[0]) del(response[0].contentURL);

  return NextResponse.json(response[0], { status: 200 });
}
