import { NextResponse } from "next/server";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2Client, { getUrlFromFileR2FileKey } from "~/server/r2";
import { getSessionWithCookies } from "~/utils/authenticate";
import { cookies } from "next/headers";
import { env } from "~/env";

export async function POST(req: Request): Promise<NextResponse> {
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

    const uploadPromises = files.map(async (file) => {
      const startFileProcess = performance.now();
      const fileExtension = file.name.split('.').pop();

      const fileKey = crypto.randomBytes(16).toString("hex") + "." + fileExtension;
      const arrayBuffer = await file.arrayBuffer();
      const stream = Buffer.from(arrayBuffer);
      const fileUrl = getUrlFromFileR2FileKey(fileKey);
      const fileName = file.name;

      const startUpload = performance.now();
      await r2Client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: fileKey,
          Body: stream,
          ContentType: file.type,
        }),
      );
      console.log(
        `Uploading file ${fileName} took: ${performance.now() - startUpload}ms`,
      );

      const startDbInsert = performance.now();
      const content = await session.createNewAttachment({
        attachmentPath: fileName,
        attachmentURL: fileUrl,
        fileKey: fileKey,
      });
      console.log(
        `DB insert for ${fileName} took: ${performance.now() - startDbInsert}ms`,
      );

      if (!content || content.type != "attachment")
        throw new Error("Failed to insert content");

      console.log(
        `Processing file ${fileName} took: ${performance.now() - startFileProcess}ms`,
      );
      return content;
    });

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
