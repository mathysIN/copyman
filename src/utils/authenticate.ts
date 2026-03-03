import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { Session, sessions, verifySessionToken } from "~/server/db/redis";
import cookie from "cookie";

const BANNED_SESSIONS = ["admin", "favicon.ico", "socket.io"];

/**
 * Get session using cookies.
 * Requires valid session token for password-protected sessions.
 */
export async function getSessionWithCookies(
  cookies: RequestCookies | ReadonlyRequestCookies,
): Promise<Session | null> {
  const sessionId = cookies.get("session")?.value;
  if (!sessionId) return null;

  const sessionToken = cookies.get("session_token")?.value;
  if (!sessionToken) return null;

  const sessionResponse = await sessions.hgetall(sessionId.toLowerCase());
  if (!sessionResponse) return null;

  const session = new Session(sessionResponse);
  const isValid = await verifySessionToken(session.sessionId, sessionToken);
  if (!isValid) return null;

  return session;
}

/**
 * Get session from cookie string (for WebSocket connections).
 * Requires valid session token.
 */
export async function getSessionWithCookieString(cookies: string) {
  const _cookies = cookie.parse(cookies);
  const sessionId = _cookies["session"];
  if (!sessionId) return null;

  const sessionToken = _cookies["session_token"];
  if (!sessionToken) return null;

  const sessionResponse = await sessions.hgetall(sessionId.toLowerCase());
  if (!sessionResponse) return null;

  const session = new Session(sessionResponse);
  const isValid = await verifySessionToken(session.sessionId, sessionToken);
  if (!isValid) return null;

  return session;
}

/**
 * Get session by session ID.
 * Does NOT verify authentication - use getSessionWithCookies for authenticated access.
 */
export async function getSessionWithSessionId(
  sessionId: string,
  _password?: string, // Deprecated parameter, kept for API compatibility
  createIfNull = false,
): Promise<Session | null> {
  return getSession(sessionId, createIfNull);
}

/**
 * Core function to get a session.
 * Does NOT perform authentication - authentication is handled via session tokens.
 */
async function getSession(
  sessionId: string,
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
  return new Session(response);
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

  // Get session data directly without password enforcement
  const sessionData = await sessions.hgetall(sessionId.toLowerCase());
  if (!sessionData) return null;
  const session = new Session(sessionData);

  const isValid = await verifySessionToken(session.sessionId, sessionToken);
  return isValid ? session : null;
}
