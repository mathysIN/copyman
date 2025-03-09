import { cookies } from "next/headers";
import {
  getSessionWithCookies
} from "~/utils/authenticate";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !session.verifyPasswordFromCookie(cookies()))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const request = await session.setBackgroundImageURL(data["background"]);
  if (!request) return NextResponse.json({ message: "Error" }, { status: 500 });

  return NextResponse.json({ message: "Background updated" });
}
