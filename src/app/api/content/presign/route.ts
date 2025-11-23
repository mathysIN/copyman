import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { env } from "~/env";
import r2Client from "~/server/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import contentDisposition from "content-disposition";
import crypto from "crypto";

const MAX_SIZE = 500 * 1024 * 1024; // 500MB per session

type PresignRequest = {
  files: { name: string; type: string; size: number }[];
};

export async function POST(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: PresignRequest | null = null;
  try {
    body = (await req.json()) as PresignRequest;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const files = body?.files ?? [];
  if (!files.length)
    return NextResponse.json({ message: "No files" }, { status: 400 });

  const usedSpace = session.getUsedSpaceNumber();
  const totalIncoming = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (usedSpace + totalIncoming > MAX_SIZE) {
    return NextResponse.json(
      { message: "Session is using to much space. Please delete some files." },
      { status: 403 },
    );
  }

  const presigned = await Promise.all(
    files.map(async (file) => {
      const fileExtension = file.name.split(".").pop() || "bin";
      const key = `${crypto.randomBytes(16).toString("hex")}.${fileExtension}`;
      const contentType = file.type || "application/octet-stream";
      const disposition = contentDisposition(file.name, { type: "inline" });

      const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        ContentDisposition: disposition,
      });

      const url = await getSignedUrl(r2Client as any, command, {
        expiresIn: 60 * 10,
      });

      return {
        key,
        url,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": disposition,
        },
        name: file.name,
        type: contentType,
        size: file.size,
      };
    }),
  );

  return NextResponse.json({ uploads: presigned });
}

