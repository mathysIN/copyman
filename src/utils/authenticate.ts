import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { Session, sessions } from "~/server/db/redis";
import cookie from "cookie";

const BANNED_SESSIONS = ["admin", "favicon.ico", "socket.io"];

export async function getSessionWithCookies(
  cookies: RequestCookies | ReadonlyRequestCookies,
  ignorePassword = false,
): Promise<Session | null> {
  const sessionId = cookies.get("session")?.value;
  if (!sessionId) return null;
  return getSession(sessionId, cookies.get("password")?.value, ignorePassword);
}

export async function getSessionWithCookieString(
  cookies: string,
  ignorePassword = false,
) {
  const _cookies = cookie.parse(cookies);
  const sessionId = _cookies["session"];
  if (!sessionId) return null;
  return getSession(sessionId, _cookies["password"], ignorePassword);
}

export async function getSessionWithSessionId(
  sessionId: string,
  password?: string,
  ignorePassword = false,
  createIfNull = false,
): Promise<Session | null> {
  return getSession(sessionId, password, ignorePassword, createIfNull);
}

async function getSession(
  sessionId: string,
  password?: string,
  ignorePassword = false,
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
  if (
    !ignorePassword &&
    session.hasPassword() &&
    !(await session.verifyPassword(password ?? ""))
  )
    return null;
  return session;
}
