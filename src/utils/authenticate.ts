import { eq } from "drizzle-orm";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { db } from "~/server/db";
import { sessions } from "~/server/db/schema";

export async function getSessionWithCookies(cookies: RequestCookies | ReadonlyRequestCookies) {
  const sessionId = cookies.get("session")?.value;
  if (!sessionId) return null;
  return await db.query.sessions.findFirst({
    where: eq(sessions.token, sessionId),
  });
}
