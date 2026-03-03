import { Session, sessions } from "~/server/db/redis";
import { verifyAuthKey } from "~/utils/password";
import { NextResponse } from "next/server";

/**
 * POST /api/sessions/verify-password
 * Verify an authentication key without creating a session or returning sensitive data.
 * Client derives authKey from password + session creation timestamp.
 * Server verifies authKey against stored hash without seeing the raw password.
 * Returns { valid: boolean } only - never returns the hash or encryption keys.
 *
 * NOTE: Legacy password format (128-char SHA512) is NOT supported.
 * Sessions with old passwords must be reset by the user.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  let body: { authKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const authKey = body.authKey;

  if (!authKey) {
    return NextResponse.json({ error: "auth_key_required" }, { status: 400 });
  }

  // Get session data directly without enforcing password check
  const sessionData = await sessions.hgetall(sessionId.toLowerCase());
  if (!sessionData) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }

  const session = new Session(sessionData);

  // Session without password protection - auth key is invalid
  if (!session.hasPassword()) {
    return NextResponse.json({ valid: false });
  }

  // Verify auth key using SHA-256 comparison
  // Only new format (64-char) is supported
  const isValid = verifyAuthKey(authKey, session.password!);

  // IMPORTANT: Never return the hash or any derived keys
  // This endpoint only returns whether the auth key is valid
  return NextResponse.json({ valid: isValid });
}
