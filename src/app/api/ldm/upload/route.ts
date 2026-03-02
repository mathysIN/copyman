import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { serverUploadFiles } from "~/lib/serverUtils";

const MAX_SIZE = 500 * 1024 * 1024;

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
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.redirect(`${getBaseUrl(req)}/?error=no_files`);
    }

    const session = await getSessionWithCookies(cookies());
    if (!session) {
      return NextResponse.redirect(`${getBaseUrl(req)}/?error=unauthorized`);
    }

    const usedSpace = session.getUsedSpaceNumber();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const newTotalSize = usedSpace + totalSize;

    if (newTotalSize > MAX_SIZE) {
      return NextResponse.redirect(`${getBaseUrl(req)}/?error=too_large`);
    }

    const uploadPromises = await serverUploadFiles(
      session,
      files,
      undefined,
      [],
    );
    await Promise.all(uploadPromises);
    session.addUsedSpace(totalSize);

    return NextResponse.redirect(getBaseUrl(req));
  } catch (error) {
    console.error("LDM File upload error:", error);
    return NextResponse.redirect(`${getBaseUrl(req)}/?error=upload_failed`);
  }
}
