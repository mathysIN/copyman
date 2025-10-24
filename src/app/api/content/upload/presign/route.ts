import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getSessionWithCookies } from "~/utils/authenticate";
import { presignPutForFile } from "~/server/r2Presign";

const MAX_SIZE = 500 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: { files: { name: string; type: string; size: number }[] };
  try {
    body = (await req.json()) as {
      files: { name: string; type: string; size: number }[];
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const files = body?.files ?? [];
  if (!files.length)
    return NextResponse.json({ error: "No files provided" }, { status: 400 });

  const usedSpace = session.getUsedSpaceNumber();
  const totalSize = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
  const newTotalSize = usedSpace + totalSize;
  if (newTotalSize > MAX_SIZE) {
    return NextResponse.json(
      { message: "Session is using to much space. Please delete some files." },
      { status: 403 },
    );
  }

  const presigned = await Promise.all(
    files.map(async (f) => {
      const fileExtension = f.name.includes(".")
        ? f.name.split(".").pop()
        : undefined;
      const fileKey = `${crypto
        .randomBytes(16)
        .toString("hex")}${fileExtension ? "." + fileExtension : ""}`;
      return presignPutForFile({
        fileKey,
        fileName: f.name,
        contentType: f.type || "application/octet-stream",
      });
    }),
  );

  return NextResponse.json({ presigned });
}
