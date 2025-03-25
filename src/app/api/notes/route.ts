import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { Session } from "~/server/db/redis";
import { serverCreateNote } from "~/lib/serverUtils";

export async function POST(req: Request) {
  const data = await req.json();
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { content } = data;
  const newNote = { content };
  const response = serverCreateNote(session, content);
  if (response) {
    return NextResponse.json(response, { status: 200 });
  } else {
    return new Response("Failed to create", { status: 500 });
  }
}


export async function PATCH(req: Request) {
  const data = await req.json();
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { content, taskId } = data;

  if (!(await session.getContent(taskId))) {
    return new Response("Not found", { status: 404 });
  }

  const response = await session.updateNote(taskId, { content: content });
  if (response) {
    return new Response("Updated", { status: 200 });
  } else {
    return new Response("Failed to update", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const data = await req.json();
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { taskId } = data;

  const response = await session.deleteContent(taskId);

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
