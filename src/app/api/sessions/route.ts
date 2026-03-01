import {
  Session,
  sessions,
  setSessionToken,
  verifySessionToken,
  clearSessionToken,
} from "~/server/db/redis";
import { cookies } from "next/headers";
import {
  getSessionWithCookies,
  getSessionWithSessionId,
} from "~/utils/authenticate";
import { NextResponse } from "next/server";
import {
  hashPassword,
  validatePassword,
  generateSessionToken,
} from "~/utils/password";
import { env } from "~/env";
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

/**
 * GET /api/sessions
 * Returns session validation status.
 * Does NOT return password hash or sensitive data.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const rawPassword = url.searchParams.get("password");
  const join = url.searchParams.get("join") == "true";

  // Get session data without enforcing password (for checking existence and metadata)
  const sessionData = sessionId
    ? await sessions.hgetall(sessionId.toLowerCase())
    : null;
  const session = sessionData ? new Session(sessionData) : null;

  if (!session) {
    return NextResponse.json({ createNewSession: true }, { status: 200 });
  }

  // Verify password if provided
  const isValidPassword = rawPassword
    ? await session.verifyPassword(rawPassword)
    : !session.hasPassword();

  // Check session token for authentication status
  const sessionToken = cookies().get("session_token")?.value;
  const isAuthenticated = sessionToken
    ? await verifySessionToken(session.sessionId, sessionToken)
    : false;

  return NextResponse.json({
    valid: isValidPassword || isAuthenticated,
    hasPassword: session.hasPassword(),
    isEncrypted: session.isEncrypted ?? false,
    createNewSession: false,
  });
}

type SessionRequestBody = {
  session?: string;
  password?: string;
  join?: boolean | string;
  create?: boolean | string;
  temporary?: boolean | string;
  isEncrypted?: boolean | string;
};

/**
 * POST /api/sessions
 * Create or join a session.
 * Accepts password in body (NOT query params).
 * Generates session token on successful auth, sets httpOnly cookie.
 * Does NOT return password hash.
 */
export async function POST(req: Request) {
  // Parse JSON body instead of form data for security
  let body: SessionRequestBody;
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    body = await req.json();
  } else {
    // Support form data for backwards compatibility during transition
    const formData = await req.formData();
    body = {};
    formData.forEach((formValue, key) => {
      (body as Record<string, string>)[key] = String(formValue);
    });
  }

  const sessionId = body.session?.toLowerCase() ?? "";
  const rawPassword = body.password;
  // Handle both boolean and string values from client
  const join = body.join === true || body.join === "true";
  const temporary = body.temporary === true || body.temporary === "true";
  const isEncrypted = body.isEncrypted === true || body.isEncrypted === "true";

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

  if (!temporary && !isValidSessionId(actualSessionId)) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });
  }

  if (!join && !temporary && isTemporarySessionId(actualSessionId)) {
    return NextResponse.json(
      { error: "cannot_create_temp_session" },
      { status: 400 },
    );
  }

  let canJoin = false;
  let session: Session | null = null;

  if (join) {
    console.log("Attempting to join session:", actualSessionId);
    // Get session data without enforcing password check (we'll verify separately)
    const sessionData = await sessions.hgetall(actualSessionId.toLowerCase());
    if (!sessionData) {
      console.log("Session not found:", actualSessionId);
      return NextResponse.json(
        { error: "invalid_session_id" },
        { status: 400 },
      );
    }
    session = new Session(sessionData);

    // Verify password using per-session salt
    if (session.hasPassword()) {
      if (!rawPassword) {
        return NextResponse.json(
          { error: "password_required" },
          { status: 401 },
        );
      }
      const isValid = await session.verifyPassword(rawPassword);
      if (!isValid) {
        return NextResponse.json(
          { error: "invalid_password" },
          { status: 401 },
        );
      }
    }

    console.log("Session found, joining:", actualSessionId);
    canJoin = true;
  } else {
    // Creating new session
    const sessionData: {
      sessionId: string;
      password?: string;
      createdAt: string;
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

    // Hash password with per-session salt
    if (rawPassword) {
      sessionData.password = hashPassword(rawPassword, sessionData.createdAt);
    }

    if (temporary) {
      sessionData.expiresAt = (
        Date.now() +
        TEMP_SESSION_DURATION_HOURS * 60 * 60 * MS_PER_SECOND
      ).toString();
      sessionData.isTemporary = true;
    }

    console.log("Creating session:", actualSessionId, {
      ...sessionData,
      password: sessionData.password ? "[REDACTED]" : undefined,
    });

    const newSession = await sessions.hmnew(actualSessionId, sessionData);
    if (!newSession) {
      console.log("Session creation failed - already exists:", actualSessionId);
      return NextResponse.json({ error: "session_exists" }, { status: 400 });
    }

    console.log("Session created successfully:", actualSessionId);
    canJoin = true;

    // Load the created session
    session = await getSessionWithSessionId(actualSessionId, undefined);
  }

  if (canJoin && session) {
    console.log("Setting session cookie for:", actualSessionId);

    // Set session ID cookie (non-httpOnly, accessible by client)
    cookies().set("session", actualSessionId, {
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      secure: env.COPYMAN_ENV === "production",
      sameSite: "strict",
    });

    // Generate and set session token for authentication
    const sessionToken = await setSessionToken(session.sessionId);
    cookies().set("session_token", sessionToken, {
      httpOnly: true,
      secure: env.COPYMAN_ENV === "production",
      sameSite: "strict",
      // No expiry = session cookie (expires when browser closes)
    });

    // DO NOT set password cookie - we use session tokens instead
    // The raw password should never be stored in cookies
  }

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/sessions
 * Update session password.
 */
export async function PATCH(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !(await session.verifyPasswordFromCookie(cookies()))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();
  const newPassword = data["password"];

  // Set new password (hashed with per-session salt automatically)
  const request = await session.setPassword(newPassword);
  if (!request) {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }

  // DO NOT set password cookie - we use session tokens
  // If password changed, clear all existing session tokens for security
  await clearSessionToken(session.sessionId);

  // Generate new session token
  const newToken = await setSessionToken(session.sessionId);
  cookies().set("session_token", newToken, {
    httpOnly: true,
    secure: env.COPYMAN_ENV === "production",
    sameSite: "strict",
  });

  socketSendPasswordChanged(session.sessionId);

  return NextResponse.json({ message: "Password updated" });
}

/**
 * DELETE /api/sessions
 * Logout - clear session token.
 */
export async function DELETE(req: Request) {
  const sessionToken = cookies().get("session_token")?.value;
  const sessionId = cookies().get("session")?.value;

  if (sessionId && sessionToken) {
    await clearSessionToken(sessionId, sessionToken);
  }

  // Clear cookies
  cookies().delete("session_token");
  cookies().delete("session");

  return NextResponse.json({ message: "Logged out" });
}
