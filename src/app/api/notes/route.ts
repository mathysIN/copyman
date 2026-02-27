import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { NoteType, Session } from "~/server/db/redis";
import {
  serverCreateNote,
  serverDeleteContent,
  serverUpdateNote,
} from "~/lib/serverUtils";
import { socketSendAddContent, io } from "~/lib/socketInstance";

export async function POST(req: Request) {
  const data = await req.json();
  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { content, isEncrypted, encryptedIv, encryptedSalt } = data;

  console.log(
    "[E2EE API] POST /api/notes - isEncrypted:",
    isEncrypted,
    "content length:",
    content?.length,
  );
  if (isEncrypted) {
    console.log(
      "[E2EE API] Note is encrypted, iv:",
      encryptedIv?.substring(0, 10) + "...",
    );
  }

  const response = await serverCreateNote(session, content, socketUserId, {
    isEncrypted,
    encryptedIv,
    encryptedSalt,
  });
  if (response) {
    return NextResponse.json(response, { status: 200 });
  } else {
    return new Response("Failed to create", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const data = await req.json();
  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { content, taskId, isEncrypted, encryptedIv, encryptedSalt } = data;

  console.log(
    "[E2EE API] PATCH /api/notes - taskId:",
    taskId,
    "isEncrypted:",
    isEncrypted,
    "content length:",
    content?.length,
  );
  if (isEncrypted) {
    console.log(
      "[E2EE API] Note update is encrypted, iv:",
      encryptedIv?.substring(0, 10) + "...",
    );
  }

  if (!(await session.getContent(taskId))) {
    return new Response("Not found", { status: 404 });
  }

  const response = await serverUpdateNote(
    session,
    content,
    taskId,
    socketUserId,
    { isEncrypted, encryptedIv, encryptedSalt },
  );
  if (response) {
    return new Response("Updated", { status: 200 });
  } else {
    return new Response("Failed to update", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const data = await req.json();
  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { taskId } = data;

  const response = await serverDeleteContent(session, taskId, socketUserId);
  if (response) {
    return new Response("Deleted", { status: 200 });
  } else {
    return new Response("Failed to delete", { status: 500 });
  }
}

export async function GET(req: Request) {
  const data = await req.json();
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
}
