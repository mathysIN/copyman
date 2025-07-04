import { NextResponse } from "next/server";
import { getSessionWithCookies } from "~/utils/authenticate";
import { cookies } from "next/headers";
import { serverUploadFiles } from "~/lib/serverUtils";
import { AttachmentType } from "~/server/db/redis";

const MAX_SIZE = 500 * 1024 * 1024;

export async function POST(
  req: Request,
): Promise<
  NextResponse<AttachmentType[] | { error?: string; message?: string }>
> {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[] | undefined;

  if (!files?.length)
    return NextResponse.json({ error: "No files provided" }, { status: 400 });

  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const usedSpace = session.getUsedSpaceNumber();
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const newTotalSize = usedSpace + totalSize;
  console.log({ usedSpace, totalSize, newTotalSize });
  if (newTotalSize > MAX_SIZE) {
    return NextResponse.json(
      { message: "Session is using to much space. Please delete some files." },
      { status: 403 },
    );
  }

  const startTotal = performance.now();
  try {
    const startParse = performance.now();
    console.log(
      `Parsing request JSON took: ${performance.now() - startParse}ms`,
    );

    const uploadPromises = await serverUploadFiles(session, files);

    const startUploads = performance.now();
    const results = await Promise.all(uploadPromises);
    console.log(`All uploads took: ${performance.now() - startUploads}ms`);

    console.log(
      `Total request processing took: ${performance.now() - startTotal}ms`,
    );
    session.addUsedSpace(totalSize);
    return NextResponse.json(results);
  } catch (error) {
    console.log(
      `Error processing request after: ${performance.now() - startTotal}ms`,
    );
    console.log(error);
    return NextResponse.json(
      { error: "Upload failed", details: error },
      { status: 500 },
    );
  }
}
