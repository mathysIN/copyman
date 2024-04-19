import { redirect } from "next/navigation";
import { sessions } from "~/server/db/redis";
import { cookies } from "next/headers";
import {
  getSessionWithCookies,
  getSessionWithSessionId,
} from "~/utils/authenticate";
import { NextResponse } from "next/server";
import { hashPassword } from "~/utils/password";

type Params = {
  sessionId?: string;
};

export async function GET(req: Request, context: { params: Params }) {
  const sessionId = context?.params?.sessionId;
  const password = cookies().get("password")?.value;
  let session;
  if (sessionId)
    session = await getSessionWithSessionId(sessionId, undefined, true);
  else session = await getSessionWithCookies(cookies(), true);
  if (!session)
    return NextResponse.json({ createNewSession: true }, { status: 200 });
  if (password) {
    cookies().set("password", hashPassword(password));
  }

  return NextResponse.json({
    ...session.toJSON(),
    hasPassword: session.hasPassword(),
    isValidPassword: await session.verifyPasswordFromCookie(cookies()),
  });
}

export async function POST(req: Request) {
  const data = await req.formData();
  const sessionId = data.get("session")?.toString()?.toLowerCase();
  const password = data.get("password")?.toString();
  if (sessionId) {
    await sessions
      .hmnew(sessionId, {
        sessionId: sessionId,
        createdAt: Date.now().toString(),
        password: data.get("password")?.toString(),
      })
      .catch(() => {});
  }
  if (password)
    cookies().set("password", hashPassword(password), {
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });
  redirect(`/${sessionId}`);
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
