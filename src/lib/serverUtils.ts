import contentDisposition from "content-disposition";
import {
  type AttachmentType,
  type Session,
  type FolderType,
} from "~/server/db/redis";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { env } from "~/env";
import r2Client, { getUrlFromFileR2FileKey } from "~/server/r2";
import {
  socketSendAddContent,
  socketSendDeleteContent,
  socketSendUpdateContent,
} from "./socketInstance";

export async function serverCreateNote(
  session: Session,
  content: string,
  senderSocketId?: string,
) {
  const newNote = { content };
  const createdNote = await session.createNewNote(newNote);
  if (createdNote) socketSendAddContent(session, [createdNote], senderSocketId);
  return createdNote;
}

export async function serverUpdateNote(
  session: Session,
  content: string,
  contentId: string,
  senderSocketId?: string,
) {
  const response = await session.updateNote(contentId, { content: content });
  if (response) {
    const updatedNote = await session.getContent(contentId); // :/
    if (!updatedNote) return;
    socketSendUpdateContent(session, updatedNote, senderSocketId);
  }
  return response;
}

export async function serverRenameFile(
  session: Session,
  contentId: string,
  fileName: string,
  senderSocketId?: string,
) {
  const response = await session.updateAttachment(contentId, {
    attachmentPath: fileName,
  });
  if (response) {
    const updatedAttachment = await session.getContent(contentId); // :/
    if (!updatedAttachment) return;
    socketSendUpdateContent(session, updatedAttachment, senderSocketId);
  }
  return response;
}

export async function serverDeleteContent(
  session: Session,
  contentId: string,
  senderSocketId?: string,
) {
  const response = await session.deleteContent(contentId);
  if (response) socketSendDeleteContent(session, contentId, senderSocketId);
  return response;
}

export async function serverUploadFiles(
  session: Session,
  files: File[],
  senderSocketId?: string,
) {
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
          type: "inline",
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

export async function serverCreateFolder(
  session: Session,
  name: string,
  targetType: "note" | "attachment",
  senderSocketId?: string,
) {
  const folder = await session.createNewFolder({
    name,
    targetType,
    contentIds: [],
  });
  if (folder) {
    socketSendAddContent(session, [folder], senderSocketId);
  }
  return folder;
}

export async function serverUpdateFolder(
  session: Session,
  folderId: string,
  updates: Partial<FolderType>,
  senderSocketId?: string,
) {
  const response = await session.updateFolder(folderId, updates);
  if (response) {
    const updatedFolder = await session.getContent(folderId);
    if (updatedFolder) {
      socketSendUpdateContent(session, updatedFolder, senderSocketId);
    }
  }
  return response;
}

export async function serverDeleteFolder(
  session: Session,
  folderId: string,
  senderSocketId?: string,
) {
  // First, move all content out of the folder
  const allContent = await session.getAllContent();
  for (const content of allContent) {
    if (
      (content.type === "note" || content.type === "attachment") &&
      (content as any).folderId === folderId
    ) {
      await session.updateNote(content.id, { folderId: undefined });
      const updatedContent = await session.getContent(content.id);
      if (updatedContent) {
        socketSendUpdateContent(session, updatedContent, senderSocketId);
      }
    }
  }

  // Then delete the folder
  const response = await session.deleteContent(folderId);
  if (response) {
    socketSendDeleteContent(session, folderId, senderSocketId);
  }
  return response;
}

export async function serverMoveContentToFolder(
  session: Session,
  contentId: string,
  folderId: string | null,
  senderSocketId?: string,
) {
  const content = await session.getContent(contentId);
  if (!content || (content.type !== "note" && content.type !== "attachment")) {
    return null;
  }

  const oldFolderId = (content as any).folderId;

  // Update the content's folderId
  if (content.type === "note") {
    await session.updateNote(contentId, { folderId });
  } else {
    await session.updateAttachment(contentId, { folderId });
  }

  // If moving into a folder, add to folder's contentIds
  if (folderId) {
    const folder = await session.getContent(folderId);
    if (folder && folder.type === "folder") {
      const folderData = folder;
      if (!folderData.contentIds.includes(contentId)) {
        await session.updateFolder(folderId, {
          contentIds: [...folderData.contentIds, contentId],
        });
        const updatedFolder = await session.getContent(folderId);
        if (updatedFolder) {
          socketSendUpdateContent(session, updatedFolder, senderSocketId);
        }
      }
    }
  }

  // If moving out of a folder, remove from old folder's contentIds
  if (oldFolderId) {
    const oldFolder = await session.getContent(oldFolderId);
    if (oldFolder && oldFolder.type === "folder") {
      const oldFolderData = oldFolder;
      await session.updateFolder(oldFolder.id, {
        contentIds: oldFolderData.contentIds.filter((id) => id !== contentId),
      });
      const updatedOldFolder = await session.getContent(oldFolder.id);
      if (updatedOldFolder) {
        socketSendUpdateContent(session, updatedOldFolder, senderSocketId);
      }
    }
  }

  // Send update for the moved content
  const updatedContent = await session.getContent(contentId);
  if (updatedContent) {
    socketSendUpdateContent(session, updatedContent, senderSocketId);
  }

  return updatedContent;
}
