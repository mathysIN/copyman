import { Session, sessions } from "~/server/db/redis";
import { cookies } from "next/headers";
import {
  getSessionWithCookies,
  getSessionWithSessionId,
} from "~/utils/authenticate";
import { NextResponse } from "next/server";
import { hashPassword } from "~/utils/password";
import {
  isValidSessionId,
  isTemporarySessionId,
  generateTemporarySessionId,
} from "~/lib/utils";
import {
  MS_PER_SECOND,
  TEMP_SESSION_DURATION_HOURS,
} from "~/constants/session";
import { socketSendPasswordChanged } from "~/lib/socketInstance";
import { setSessionCookie, setPasswordCookie } from "~/lib/cookies";

// Force dynamic rendering - this route uses request.url at runtime
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const rawPassword = url.searchParams.get("password");
  const password = rawPassword ? hashPassword(rawPassword) : undefined;
  const join = url.searchParams.get("join") == "true";
  const session = sessionId
    ? await getSessionWithSessionId(sessionId, undefined, true)
    : null;
  if (!session)
    return NextResponse.json({ createNewSession: true }, { status: 200 });

  return NextResponse.json({
    ...session.toJSON(),
    password,
    hasPassword: session.hasPassword(),
    isValidPassword: await session.verifyPassword(password),
    isEncrypted: session.isEncrypted ?? false,
  });
}

export async function POST(req: Request) {
  const data = await req.formData();
  const sessionId = data.get("session")?.toString()?.toLowerCase() ?? "";
  const rawPassword = data.get("password")?.toString();
  const password = rawPassword && hashPassword(rawPassword);
  const join = data.get("join")?.toString() == "true";
  const temporary = data.get("temporary")?.toString() == "true";
  const isEncrypted = data.get("isEncrypted")?.toString() == "true";

  console.log(
    "POST /api/sessions - sessionId:",
    sessionId,
    "join:",
    join,
    "temporary:",
    temporary,
    "isEncrypted:",
    isEncrypted,
  );

  let actualSessionId = sessionId;

  if (temporary) {
    actualSessionId = generateTemporarySessionId();
    console.log("Generated temp session ID:", actualSessionId);
  }

  if (!temporary && !isValidSessionId(actualSessionId))
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });

  if (!join && !temporary && isTemporarySessionId(actualSessionId))
    return NextResponse.json(
      { error: "cannot_create_temp_session" },
      { status: 400 },
    );

  let canJoin = false;
  if (join) {
    console.log("Attempting to join session:", actualSessionId);
    const session = await getSessionWithSessionId(
      actualSessionId,
      password,
      true,
      false,
    );
    if (!session) {
      console.log("Session not found:", actualSessionId);
      return NextResponse.json(
        { error: "invalid_session_id" },
        { status: 400 },
      );
    }
    console.log("Session found, joining:", actualSessionId);
    canJoin = true;
  } else {
    const sessionData: {
      sessionId: string;
      createdAt: string;
      password?: string;
      rawContentOrder: string;
      expiresAt?: string;
      isTemporary?: boolean;
      isEncrypted?: boolean;
    } = {
      sessionId: actualSessionId,
      createdAt: Date.now().toString(),
      rawContentOrder: "",
      isEncrypted: isEncrypted,
    };

    if (password) {
      sessionData.password = password;
    }

    if (temporary) {
      sessionData.expiresAt = (
        Date.now() +
        TEMP_SESSION_DURATION_HOURS * 60 * 60 * MS_PER_SECOND
      ).toString();
      sessionData.isTemporary = true;
    }

    console.log("Creating session:", actualSessionId, sessionData);

    const newSession = await sessions.hmnew(actualSessionId, sessionData);
    if (!newSession) {
      console.log("Session creation failed - already exists:", actualSessionId);
      return NextResponse.json({ error: "session_exists" }, { status: 400 });
    }

    console.log("Session created successfully:", actualSessionId);
    canJoin = true;
  }

  if (canJoin) {
    console.log("Setting cookie for session:", actualSessionId);
    setSessionCookie(cookies(), actualSessionId);
    if (password) setPasswordCookie(cookies(), password);
  }

  // Check if this was a form submission from LDM (not AJAX/fetch from React)
  // LDM forms don't send Accept header or send text/html
  // React fetch should send Accept: application/json
  const acceptHeader = req.headers.get("accept") || "";
  const wantsJSON = acceptHeader.includes("application/json");

  if (!wantsJSON) {
    // This is a form submission from LDM - redirect back
    const referer = req.headers.get("referer");
    const host = req.headers.get("host") || "localhost";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = referer ? new URL(referer).origin : `${protocol}://${host}`;
    return NextResponse.redirect(`${baseUrl}/`);
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !session.verifyPasswordFromCookie(cookies()))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const request = await session.setPassword(data["password"]);
  if (!request) return NextResponse.json({ message: "Error" }, { status: 500 });
  setPasswordCookie(cookies(), hashPassword(data["password"]));

  socketSendPasswordChanged(session.sessionId);

  return NextResponse.json({ message: "Password updated" });
}
