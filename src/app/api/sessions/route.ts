import { redirect } from "next/navigation";
import { sessions } from "~/server/db/redis";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const data = await req.formData();
  const sessionId = data.get("session")?.toString();
  if (sessionId) {
    await sessions
      .hmnew(sessionId, {
        sessionId: sessionId,
        createdAt: Date.now().toString(),
      })
      .catch(() => {});
  }
  redirect(`/${sessionId}`);
}
