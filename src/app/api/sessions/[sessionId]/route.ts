import { deleteSession } from "~/server/db/redis";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !session.verifyPasswordFromCookie(cookies()))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (session.sessionId !== params.sessionId)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  await deleteSession(session.sessionId);

  return NextResponse.json({ message: "Session deleted" });
}
