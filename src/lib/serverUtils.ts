import contentDisposition from 'content-disposition';
import { type AttachmentType, type Session } from "~/server/db/redis";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { env } from "~/env";
import r2Client, { getUrlFromFileR2FileKey } from "~/server/r2";
import { socketSendAddContent, socketSendDeleteContent } from "./socketInstance";

export async function serverCreateNote(session: Session, content: string) {
  const newNote = { content };
  const response = await session.createNewNote(newNote);
  if (response) socketSendAddContent(session, [response]);
  return response;
}

export async function serverDeleteNote(session: Session, contentId: string) {
  const response = await session.deleteContent(contentId);
  if (response) socketSendDeleteContent(session, contentId);
  return response;
}

export async function serverUploadFiles(session: Session, files: File[], socketId?: string) {
  const createdAttachments: AttachmentType[] = [];
  for (const file of files) {
    const startFileProcess = performance.now();
    const fileExtension = file.name.split(".").pop();

    const fileKey =
      crypto.randomBytes(16).toString("hex") + "." + fileExtension;
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
        ContentDisposition: contentDisposition(fileName, {
          type: "inline"
        }),
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
    createdAttachments.push(content);
    socketSendAddContent(session, createdAttachments, socketId);
  }
  return createdAttachments;
}
