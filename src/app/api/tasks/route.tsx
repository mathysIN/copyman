import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "~/server/db";
import { tasks } from "~/server/db/schema";
import { getSessionWithCookies } from "~/utils/authenticate";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const data = await req.json();
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { name, content } = data;
  const response = await db
    .insert(tasks)
    .values({ name, content, sessionId: session.id })
    .returning();

  if (response && response[0]) {
    return NextResponse.json(response[0], { status: 200 });
  } else {
    return new Response("Failed to create", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const data = await req.json();
  const session = await getSessionWithCookies(cookies());
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { name, content, taskId } = data;
  const response = await db
    .update(tasks)
    .set({ name, content })
    .where(eq(tasks.id, taskId))
    .execute()
    .catch(() => {});

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
  const response = await db
    .delete(tasks)
    .where(eq(tasks.id, taskId))
    .execute()
    .catch(() => {});

  if (response) {
    return new Response("Deleted", { status: 200 });
  } else {
    return new Response("Failed to delete", { status: 500 });
  }
}
