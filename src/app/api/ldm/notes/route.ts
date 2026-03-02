import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { serverCreateNote } from "~/lib/serverUtils";

// Force dynamic rendering - this route uses request.url at runtime
export const dynamic = "force-dynamic";

function getBaseUrl(req: Request): string {
  const host = req.headers.get("host") || "localhost";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const content = formData.get("content")?.toString();

    if (!content || content.trim() === "") {
      return NextResponse.redirect(`${getBaseUrl(req)}/?error=empty_note`);
    }

    const session = await getSessionWithCookies(cookies());
    if (!session) {
      return NextResponse.redirect(`${getBaseUrl(req)}/?error=unauthorized`);
    }

    await serverCreateNote(session, content, undefined);

    return NextResponse.redirect(getBaseUrl(req));
  } catch (error) {
    console.error("LDM Note creation error:", error);
    return NextResponse.redirect(`${getBaseUrl(req)}/?error=failed`);
  }
}
