import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSessionCookies } from "~/lib/cookies";

// Force dynamic rendering - this route uses request headers at runtime
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = cookies();
  deleteSessionCookies(cookieStore);

  // Redirect using referer header or construct from request
  const referer = req.headers.get("referer");
  if (referer) {
    const refererUrl = new URL(referer);
    return NextResponse.redirect(`${refererUrl.protocol}//${refererUrl.host}/`);
  }

  // Fallback to current host
  const host = req.headers.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  return NextResponse.redirect(`${protocol}://${host}/`);
}
