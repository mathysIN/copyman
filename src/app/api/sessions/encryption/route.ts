import { NextResponse } from "next/server";
import { getSessionWithCookies } from "~/utils/authenticate";
import { cookies } from "next/headers";
import { socketSendEncryptionState } from "~/lib/socketInstance";

export async function POST(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { isEncrypted } = body;

    if (typeof isEncrypted !== "boolean") {
      return NextResponse.json(
        { error: "isEncrypted must be a boolean" },
        { status: 400 },
      );
    }

    if (isEncrypted && !session.hasPassword()) {
      return NextResponse.json(
        { error: "Session must have a password to enable encryption" },
        { status: 400 },
      );
    }

    if (!isEncrypted && session.isEncrypted) {
      console.log(
        "[E2EE] Warning: Disabling encryption for session",
        session.sessionId,
        "- existing encrypted content may become unreadable",
      );
    }

    await session.setIsEncrypted(isEncrypted);

    socketSendEncryptionState(session.sessionId, isEncrypted);

    console.log(
      "[E2EE] Session encryption updated:",
      session.sessionId,
      "isEncrypted:",
      isEncrypted,
    );

    return NextResponse.json({
      success: true,
      isEncrypted: session.isEncrypted,
    });
  } catch (error) {
    console.error("[E2EE] Failed to update encryption:", error);
    return NextResponse.json(
      { error: "Failed to update encryption" },
      { status: 500 },
    );
  }
}
