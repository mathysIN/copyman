import { redirect } from "next/navigation";
import { Session, sessions } from "~/server/db/redis";
import { cookies } from "next/headers";
import {
  getSessionWithCookies,
  getSessionWithSessionId,
} from "~/utils/authenticate";
import { NextResponse } from "next/server";
import { hashPassword } from "~/utils/password";
import { isValidSessionId } from "~/lib/utils";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const rawPassword = url.searchParams.get("password");
  const password = rawPassword ? hashPassword(rawPassword) : undefined;
  const join = url.searchParams.get("join") == "true";
  const session = sessionId
    ? await getSessionWithSessionId(sessionId, undefined, true)
    : null;
  if (!session)
    return NextResponse.json({ createNewSession: true }, { status: 200 });

  return NextResponse.json({
    ...session.toJSON(),
    password,
    hasPassword: session.hasPassword(),
    isValidPassword: await session.verifyPassword(password),
  });
}

export async function POST(req: Request) {
  const data = await req.formData();
  const sessionId = data.get("session")?.toString()?.toLowerCase() ?? "";
  const rawPassword = data.get("password")?.toString();
  const password = rawPassword && hashPassword(rawPassword);
  const join = data.get("join")?.toString() == "true";
  if (!isValidSessionId(sessionId)) return redirect("/?msg=invalid_session_id");
  let canJoin = false;
  if (join) {
    const session = await getSessionWithSessionId(
      sessionId ?? "",
      password,
      true,
      false,
    );
    if (!session) return redirect("/?msg=invalid_session_id");
    canJoin = true;
  } else {
    const sessionData: {
      sessionId: string;
      createdAt: string;
      password?: string;
      rawContentOrder: string;
    } = {
      sessionId: sessionId,
      password: password,
      createdAt: Date.now().toString(),
      rawContentOrder: "",
    };

    const newSession = await sessions
      .hmnew(sessionId, sessionData)
      .catch(() => {});

    if (!newSession) return redirect("/?msg=session_exists");
    canJoin = true;
  }

  if (canJoin) {
    cookies().set("session", sessionId, {
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });
    if (password)
      cookies().set("password", password, {
        expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
      });
  }
  return redirect("/");
}

export async function PATCH(req: Request) {
  const session = await getSessionWithCookies(cookies());
  if (!session || !session.verifyPasswordFromCookie(cookies()))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const request = await session.setPassword(data["password"]);
  if (!request) return NextResponse.json({ message: "Error" }, { status: 500 });
  cookies().set("password", hashPassword(data["password"]), {
    expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  });

  return NextResponse.json({ message: "Password updated" });
}
