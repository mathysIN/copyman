import type { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export function setSessionCookie(
  cookies: RequestCookies | ReadonlyRequestCookies,
  sessionId: string,
) {
  cookies.set("session", sessionId, {
    expires: new Date(Date.now() + TEN_YEARS_MS),
    path: "/",
  });
}

export function setPasswordCookie(
  cookies: RequestCookies | ReadonlyRequestCookies,
  password: string,
) {
  cookies.set("password", password, {
    expires: new Date(Date.now() + TEN_YEARS_MS),
    path: "/",
  });
}

export function deleteSessionCookies(
  cookies: RequestCookies | ReadonlyRequestCookies,
) {
  cookies.set("session", "", {
    expires: new Date(0),
    path: "/",
  });
  cookies.set("password", "", {
    expires: new Date(0),
    path: "/",
  });
}
