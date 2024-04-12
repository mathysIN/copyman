import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { PreSession } from "~/components/sessions/PreSession";
import { ActiveSession } from "~/components/sessions/ActiveSession";
import { db } from "~/server/db";
import { contentType, sessions, tasks, tasksType } from "~/server/db/schema";

export default async function HomePage() {
  const sessionId = cookies().get("session")?.value;
  let session;
  let sessionTasks: tasksType[] = [];
  let sessionContents: contentType[] = [];
  if (sessionId)
    session = await db.query.sessions.findFirst({
      where: eq(sessions.token, sessionId),
    });

  if (session) {
    sessionTasks = await db.query.tasks.findMany({
      where: eq(tasks.sessionId, session.id),
    });

    sessionContents = await db.query.contents.findMany({
      where: eq(tasks.sessionId, session.id),
    });
  }

  return (
    <main className="relative flex min-h-screen flex-col  bg-[#287d7c] text-white">
      <div className="mx-auto flex flex-col items-center py-8">
        <h1 className="text-4xl font-bold ">Copyman</h1>
        <p className="text-lg">A bad unsecured pastebin for my projects</p>
      </div>
      <div className="h-8" />
      <div className="flex flex-col items-center justify-center ">
        {!session && <PreSession />}
        {session && (
          <ActiveSession
            session={session}
            sessionTasks={sessionTasks}
            sessionContents={sessionContents}
          />
        )}
      </div>
    </main>
  );
}
