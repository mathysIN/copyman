import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import contentDisposition from "content-disposition";
import r2Client, { getUrlFromFileR2FileKey } from "~/server/r2";
import { env } from "~/env";

export async function presignPutForFile(params: {
  fileKey: string;
  fileName: string;
  contentType: string;
  expiresIn?: number; // seconds
}) {
  const { fileKey, fileName, contentType, expiresIn = 15 * 60 } = params;
  const contentDisp = contentDisposition(fileName, { type: "inline" });
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
    ContentDisposition: contentDisp,
  });
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  return {
    fileKey,
    uploadUrl,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisp,
    } as Record<string, string>,
    publicUrl: getUrlFromFileR2FileKey(fileKey),
  };
}
