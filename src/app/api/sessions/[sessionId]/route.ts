import { deleteSession } from "~/server/db/redis";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { NextResponse } from "next/server";
import { verifyAuthKey } from "~/utils/password";

export async function DELETE(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !(await session.verifyPasswordFromCookie(cookies())))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (session.sessionId !== params.sessionId.toLowerCase())
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  // If session has password, require authKey verification
  if (session.hasPassword()) {
    const body = await req.json().catch(() => ({}));
    const { authKey } = body;

    if (!authKey) {
      return NextResponse.json(
        { message: "Password required", error: "auth_key_required" },
        { status: 403 },
      );
    }

    // Verify the authKey against stored password hash
    const isValidAuth = verifyAuthKey(authKey, session.password!);
    if (!isValidAuth) {
      return NextResponse.json(
        { message: "Invalid password", error: "invalid_auth_key" },
        { status: 403 },
      );
    }
  }

  await deleteSession(session.sessionId);

  return NextResponse.json({ message: "Session deleted" });
}

export async function PATCH(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !(await session.verifyPasswordFromCookie(cookies())))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (session.sessionId !== params.sessionId.toLowerCase())
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  console.log({ tempSession: session });

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
