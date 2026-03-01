import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { Session, sessions, verifySessionToken } from "~/server/db/redis";
import cookie from "cookie";

const BANNED_SESSIONS = ["admin", "favicon.ico", "socket.io"];

/**
 * Get session using cookies.
 * Requires valid session token or password for password-protected sessions.
 */
export async function getSessionWithCookies(
  cookies: RequestCookies | ReadonlyRequestCookies,
): Promise<Session | null> {
  const sessionId = cookies.get("session")?.value;
  if (!sessionId) return null;

  // First try session token authentication (preferred method)
  const sessionToken = cookies.get("session_token")?.value;
  if (sessionToken) {
    // Get session without password check - we'll verify via session token
    const sessionResponse = await sessions.hgetall(sessionId.toLowerCase());
    if (sessionResponse) {
      const session = new Session(sessionResponse);
      const isValid = await verifySessionToken(session.sessionId, sessionToken);
      if (isValid) {
        return session;
      }
    }
  }

  // Fall back to password verification (deprecated but supported for backwards compatibility)
  const password = cookies.get("password")?.value;
  return getSession(sessionId, password);
}

/**
 * Get session from cookie string (for WebSocket connections).
 */
export async function getSessionWithCookieString(cookies: string) {
  const _cookies = cookie.parse(cookies);
  const sessionId = _cookies["session"];
  if (!sessionId) return null;

  // Try session token first
  const sessionToken = _cookies["session_token"];
  if (sessionToken) {
    // Get session without password check - we'll verify via session token
    const sessionResponse = await sessions.hgetall(sessionId.toLowerCase());
    if (sessionResponse) {
      const session = new Session(sessionResponse);
      const isValid = await verifySessionToken(session.sessionId, sessionToken);
      if (isValid) {
        return session;
      }
    }
  }

  // Fall back to password
  const password = _cookies["password"];
  return getSession(sessionId, password);
}

/**
 * Get session by session ID.
 * Password must be provided for password-protected sessions.
 */
export async function getSessionWithSessionId(
  sessionId: string,
  password?: string,
  createIfNull = false,
): Promise<Session | null> {
  return getSession(sessionId, password, createIfNull);
}

/**
 * Core function to get a session.
 * ALWAYS verifies password if the session has one set.
 */
async function getSession(
  sessionId: string,
  password?: string,
  createIfNull = false,
): Promise<Session | null> {
  const sessionIdLower = sessionId.toLowerCase();
  if (BANNED_SESSIONS.includes(sessionIdLower)) return null;

  let response = await sessions.hgetall(sessionIdLower);
  if (!response && !createIfNull) return null;
  if (!response && createIfNull) {
    const newSession = {
      sessionId: sessionIdLower,
      createdAt: Date.now().toString(),
      rawContentOrder: "",
    };
    const createResponse = await sessions.hmnew(sessionIdLower, newSession);
    if (!createResponse) return null;
    response = await sessions.hgetall(sessionIdLower);
  }
  if (!response) return null;
  const session = new Session(response);

  // ALWAYS verify password if session has one
  if (session.hasPassword()) {
    const passwordValid = await session.verifyPassword(password);
    if (!passwordValid) {
      return null;
    }
  }

  return session;
}

/**
 * Verify session authentication using session token.
 * This is the preferred authentication method.
 */
export async function verifySessionAuthentication(
  cookies: RequestCookies | ReadonlyRequestCookies,
): Promise<Session | null> {
  const sessionId = cookies.get("session")?.value;
  const sessionToken = cookies.get("session_token")?.value;

  if (!sessionId || !sessionToken) return null;

  const session = await getSessionWithSessionId(sessionId, undefined);
  if (!session) return null;

  const isValid = await verifySessionToken(session.sessionId, sessionToken);
  return isValid ? session : null;
}
