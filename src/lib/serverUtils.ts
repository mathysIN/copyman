import contentDisposition from 'content-disposition';
import { type AttachmentType, type Session } from "~/server/db/redis";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { env } from "~/env";
import r2Client, { getUrlFromFileR2FileKey } from "~/server/r2";
import { socketSendAddContent, socketSendDeleteContent, socketSendUpdateContent } from "./socketInstance";

export async function serverCreateNote(session: Session, content: string, senderSocketId?: string) {
  const newNote = { content };
  const createdNote = await session.createNewNote(newNote);
  if (createdNote) socketSendAddContent(session, [createdNote], senderSocketId);
  return createdNote;
}

export async function serverUpdateNote(session: Session, content: string, contentId: string, senderSocketId?: string) {
  const response = await session.updateNote(contentId, { content: content });
  if (response) {
    const updatedNote = await session.getContent(contentId); // :/
    socketSendUpdateContent(session, updatedNote, senderSocketId);
  }
  return response;
}

export async function serverRenameFile(session: Session, contentId: string, fileName: string, senderSocketId?: string) {
  const response = await session.updateAttachment(contentId, { attachmentPath: fileName });
  if (response) {
    const updatedAttachment = await session.getContent(contentId); // :/
    socketSendUpdateContent(session, updatedAttachment, senderSocketId);
  }
  return response;
}

export async function serverDeleteContent(session: Session, contentId: string, senderSocketId?: string) {
  const response = await session.deleteContent(contentId);
  if (response) socketSendDeleteContent(session, contentId, senderSocketId);
  return response;
}

export async function serverUploadFiles(session: Session, files: File[], senderSocketId?: string) {
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
  }
  socketSendAddContent(session, createdAttachments, senderSocketId);
  return createdAttachments;
}
