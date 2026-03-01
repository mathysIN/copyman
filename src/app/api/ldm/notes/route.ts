import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { serverCreateNote } from "~/lib/serverUtils";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const content = formData.get("content")?.toString();

    if (!content || content.trim() === "") {
      return NextResponse.redirect(new URL("/ldm?error=empty_note", req.url));
    }

    const session = await getSessionWithCookies(cookies());
    if (!session) {
      return NextResponse.redirect(new URL("/ldm?error=unauthorized", req.url));
    }

    await serverCreateNote(session, content, undefined);

    return NextResponse.redirect(new URL("/ldm", req.url));
  } catch (error) {
    console.error("LDM Note creation error:", error);
    return NextResponse.redirect(new URL("/ldm?error=failed", req.url));
  }
}
