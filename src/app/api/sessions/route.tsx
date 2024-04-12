import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "~/server/db";
import { sessions } from "~/server/db/schema";

export async function POST(req: Request) {
  const data = await req.formData();
  const sessionId = data.get("session")?.toString();
  if (sessionId) {
    await db
      .insert(sessions)
      .values({ token: sessionId })
      .execute()
      .catch(() => {});
    cookies().set("session", sessionId);
  }
  return redirect("/");
}
