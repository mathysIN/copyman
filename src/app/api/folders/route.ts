import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import {
  serverCreateFolder,
  serverUpdateFolder,
  serverDeleteFolder,
} from "~/lib/serverUtils";

export async function POST(req: Request) {
  const data = await req.json();
  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;
  const session = await getSessionWithCookies(cookies());

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { name, targetType, sessionId } = data;

  if (!name || !targetType) {
    return NextResponse.json(
      { message: "name and targetType are required" },
      { status: 400 },
    );
  }

  if (targetType !== "note" && targetType !== "attachment") {
    return NextResponse.json(
      { message: "targetType must be 'note' or 'attachment'" },
      { status: 400 },
    );
  }

  const folder = await serverCreateFolder(
    session,
    name,
    targetType,
    socketUserId,
  );

  if (folder) {
    return NextResponse.json(folder, { status: 200 });
  } else {
    return NextResponse.json(
      { message: "Failed to create folder" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const data = await req.json();
  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;
  const session = await getSessionWithCookies(cookies());

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { folderId, name, contentIds } = data;

  if (!folderId) {
    return NextResponse.json(
      { message: "folderId is required" },
      { status: 400 },
    );
  }

  const updates: { name?: string; contentIds?: string[] } = {};
  if (name !== undefined) updates.name = name;
  if (contentIds !== undefined) updates.contentIds = contentIds;

  const response = await serverUpdateFolder(
    session,
    folderId,
    updates,
    socketUserId,
  );

  if (response) {
    return NextResponse.json({ message: "Updated" }, { status: 200 });
  } else {
    return NextResponse.json(
      { message: "Failed to update folder" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId")?.toString();
  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;
  const session = await getSessionWithCookies(cookies());

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!folderId) {
    return NextResponse.json(
      { message: "folderId is required" },
      { status: 400 },
    );
  }

  const response = await serverDeleteFolder(session, folderId, socketUserId);

  if (response) {
    return NextResponse.json({ message: "Deleted" }, { status: 200 });
  } else {
    return NextResponse.json(
      { message: "Failed to delete folder" },
      { status: 500 },
    );
  }
}
