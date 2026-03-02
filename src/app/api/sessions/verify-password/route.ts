import { Session, sessions } from "~/server/db/redis";
import { verifyAuthKey, hashAuthKey } from "~/utils/password";
import { NextResponse } from "next/server";

/**
 * POST /api/sessions/verify-password
 * Verify an authentication key without creating a session or returning sensitive data.
 * Client derives authKey from password + session creation timestamp.
 * Server verifies authKey against stored hash without seeing the raw password.
 * Returns { valid: boolean } only - never returns the hash or encryption keys.
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
  const computedHash = hashAuthKey(authKey);
  console.log("[VERIFY] Comparing keys:", {
    sessionId: sessionId.toLowerCase(),
    authKeyPreview: authKey.substring(0, 16) + "...",
    computedHashPreview: computedHash.substring(0, 16) + "...",
    storedHashPreview: session.password!.substring(0, 16) + "...",
    timestamp: session.createdAt,
  });

  const isValid = verifyAuthKey(authKey, session.password!);
  console.log("[VERIFY] Result:", isValid);

  // IMPORTANT: Never return the hash or any derived keys
  // This endpoint only returns whether the auth key is valid
  return NextResponse.json({ valid: isValid });
}
