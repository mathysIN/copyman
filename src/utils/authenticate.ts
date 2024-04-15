import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { Session, sessions } from "~/server/db/redis";

export async function getSessionWithCookies(
  cookies: RequestCookies | ReadonlyRequestCookies,
): Promise<Session | null> {
  const sessionId = cookies.get("session")?.value;
  if (!sessionId) return null;
  return getSession(sessionId, cookies.get("password")?.value);
}

export async function getSessionWithSessionId(
  sessionId: string,
  password?: string,
): Promise<Session | null> {
  return getSession(sessionId, password);
}

async function getSession(sessionId: string, password?: string) {
  const response = await sessions.hgetall(sessionId);
  if (!response) return null;
  const session = new Session(response);
  if (session.hasPassword() && !(await session.verifyPassword(password ?? "")))
    return null;
  return session;
}
