import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { Session, SessionType, sessions } from "~/server/db/redis";

export async function getSessionWithCookies(
  cookies: RequestCookies | ReadonlyRequestCookies,
): Promise<Session | null> {
  const sessionId = cookies.get("session")?.value;
  if (!sessionId) return null;
  const response = await sessions.hgetall(sessionId);
  if (!response) return null;
  return new Session(response);
}

export async function getSessionWithSessionId(
  sessionId: string,
): Promise<Session | null> {
  const response = await sessions.hgetall(sessionId);
  if (!response) return null;
  return new Session(response);
}
