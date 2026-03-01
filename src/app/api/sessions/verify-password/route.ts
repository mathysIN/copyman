import { Session, sessions } from "~/server/db/redis";
import { NextResponse } from "next/server";

/**
 * POST /api/sessions/verify-password
 * Verify a password without creating a session or returning sensitive data.
 * Used for E2EE key derivation - client sends password, server verifies against stored hash.
 * Returns { valid: boolean } only - never returns the hash or encryption keys.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const rawPassword = body.password;

  if (!rawPassword) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }

  // Get session data directly without enforcing password check
  const sessionData = await sessions.hgetall(sessionId.toLowerCase());
  if (!sessionData) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }

  const session = new Session(sessionData);

  // Session without password - any password is invalid for E2EE
  if (!session.hasPassword()) {
    return NextResponse.json({ valid: false });
  }

  // Verify password using per-session salt
  const isValid = await session.verifyPassword(rawPassword);

  // IMPORTANT: Never return the hash or any derived keys
  // This endpoint only returns whether the password is valid
  return NextResponse.json({ valid: isValid });
}
