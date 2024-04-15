import { redirect } from "next/navigation";
import { sessions } from "~/server/db/redis";
import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { NextResponse } from "next/server";
import { hashPassword } from "~/utils/password";

export async function POST(req: Request) {
  const data = await req.formData();
  const sessionId = data.get("session")?.toString();
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
  session.setPassword(data["password"]);

  return NextResponse.json({ message: "Password updated" });
}
