import { deleteSession, sessions } from "~/server/db/redis";
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

  if (session.sessionId !== params.sessionId.toLowerCase())
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  await deleteSession(session.sessionId);

  return NextResponse.json({ message: "Session deleted" });
}

export async function PATCH(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !session.verifyPasswordFromCookie(cookies()))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (session.sessionId !== params.sessionId.toLowerCase())
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  if (!session.isTemporarySession())
    return NextResponse.json(
      { message: "Not a temporary session" },
      { status: 400 },
    );

  const body = await req.json();
  const hours = body.hours ?? 1;

  await session.extendSession(hours);

  return NextResponse.json({
    message: "Session extended",
    expiresAt: session.getExpiresAt(),
  });
}
