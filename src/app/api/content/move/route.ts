import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { serverMoveContentToFolder } from "~/lib/serverUtils";

export async function PATCH(req: Request) {
  const data = await req.json();
  const socketUserId = req.headers.get("X-Socket-User-Id") ?? undefined;
  const session = await getSessionWithCookies(cookies());

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { contentId, folderId } = data;

  if (!contentId) {
    return NextResponse.json(
      { message: "contentId is required" },
      { status: 400 },
    );
  }

  const response = await serverMoveContentToFolder(
    session,
    contentId,
    folderId,
    socketUserId,
  );

  if (response) {
    return NextResponse.json(response, { status: 200 });
  } else {
    return NextResponse.json(
      { message: "Failed to move content" },
      { status: 500 },
    );
  }
}
