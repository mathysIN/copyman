import { NextResponse } from "next/server";
import { getSessionWithCookies } from "~/utils/authenticate";
import { cookies } from "next/headers";
import { serverUploadFiles } from "~/lib/serverUtils";
import { AttachmentType } from "~/server/db/redis";

export async function POST(
  req: Request,
): Promise<
  NextResponse<AttachmentType[] | { error?: string; message?: string }>
> {
  const formData = await req.formData();
  const files = formData.getAll("files") as File[] | undefined;

  if (!files?.length)
    return NextResponse.json({ error: "No files provided" }, { status: 400 });

  const startTotal = performance.now();

  const session = await getSessionWithCookies(cookies());

  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

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
