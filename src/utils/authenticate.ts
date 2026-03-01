import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { Session, sessions, verifySessionToken } from "~/server/db/redis";
import cookie from "cookie";

const BANNED_SESSIONS = ["admin", "favicon.ico", "socket.io"];

/**
 * Get session from record (e.g., form data or query params).
 * @deprecated Use session token authentication instead
 */
export async function getSessionWithRecord(
  record: Record<string, string>,
  ignorePassword = false,
): Promise<Session | null> {
  const sessionId = record["session"];
  if (!sessionId) return null;
  const password = record["password"];
  return getSession(sessionId, password, ignorePassword);
}

/**
 * Get session using cookies.
 * First tries session token authentication, falls back to password (deprecated).
 */
export async function getSessionWithCookies(
  cookies: RequestCookies | ReadonlyRequestCookies,
  ignorePassword = false,
): Promise<Session | null> {
  const sessionId = cookies.get("session")?.value;
  if (!sessionId) return null;

  // First try session token authentication (new secure method)
  const sessionToken = cookies.get("session_token")?.value;
  if (sessionToken) {
    const session = await getSession(sessionId, undefined, true);
    if (session) {
      const isValid = await verifySessionToken(session.sessionId, sessionToken);
      if (isValid) {
        return session;
      }
    }
  }

  // Fall back to password verification (deprecated, for backwards compatibility)
  const password = cookies.get("password")?.value;
  return getSession(sessionId, password, ignorePassword);
}

/**
 * Get session from cookie string (for WebSocket connections).
 */
export async function getSessionWithCookieString(
  cookies: string,
  ignorePassword = false,
) {
  const _cookies = cookie.parse(cookies);
  const sessionId = _cookies["session"];
  if (!sessionId) return null;

  // Try session token first
  const sessionToken = _cookies["session_token"];
  if (sessionToken) {
    const session = await getSession(sessionId, undefined, true);
    if (session) {
      const isValid = await verifySessionToken(session.sessionId, sessionToken);
      if (isValid) {
        return session;
      }
    }
  }

  // Fall back to password
  const password = _cookies["password"];
  return getSession(sessionId, password, ignorePassword);
}

/**
 * Get session by session ID.
 * Password is only used if the session has a password set.
 */
export async function getSessionWithSessionId(
  sessionId: string,
  password?: string,
  ignorePassword = false,
  createIfNull = false,
): Promise<Session | null> {
  return getSession(sessionId, password, ignorePassword, createIfNull);
}

/**
 * Core function to get a session.
 * Verifies password if the session has one set and ignorePassword is false.
 */
async function getSession(
  sessionId: string,
  password?: string,
  ignorePassword = false,
  createIfNull = false,
): Promise<Session | null> {
  const sessionIdLower = sessionId.toLowerCase();
  console.log("getting session " + sessionIdLower);
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
  console.log(response);
  const session = new Session(response);

  // Verify password if session has one and we're not ignoring passwords
  if (
    !ignorePassword &&
    session.hasPassword() &&
    !(await session.verifyPassword(password))
  ) {
    return null;
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

  const session = await getSessionWithSessionId(sessionId, undefined, true);
  if (!session) return null;

  const isValid = await verifySessionToken(session.sessionId, sessionToken);
  return isValid ? session : null;
}
