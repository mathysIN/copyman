import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { serverUploadFiles } from "~/lib/serverUtils";

const MAX_SIZE = 500 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.redirect(new URL("/ldm?error=no_files", req.url));
    }

    const session = await getSessionWithCookies(cookies());
    if (!session) {
      return NextResponse.redirect(new URL("/ldm?error=unauthorized", req.url));
    }

    const usedSpace = session.getUsedSpaceNumber();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const newTotalSize = usedSpace + totalSize;

    if (newTotalSize > MAX_SIZE) {
      return NextResponse.redirect(new URL("/ldm?error=too_large", req.url));
    }

    const uploadPromises = await serverUploadFiles(
      session,
      files,
      undefined,
      [],
    );
    await Promise.all(uploadPromises);
    session.addUsedSpace(totalSize);

    return NextResponse.redirect(new URL("/ldm", req.url));
  } catch (error) {
    console.error("LDM File upload error:", error);
    return NextResponse.redirect(new URL("/ldm?error=upload_failed", req.url));
  }
}
