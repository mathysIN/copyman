import { eq, desc } from "drizzle-orm";
import { cookies } from "next/headers";
import { PreSession } from "~/components/sessions/PreSession";
import { ActiveSession } from "~/components/sessions/ActiveSession";
import { db } from "~/server/db";
import type { contentType, tasksType } from "~/server/db/schema";
import { sessions, tasks } from "~/server/db/schema";
import { getSessionWithCookies } from "~/utils/authenticate";

export default async function HomePage() {
  const session = await getSessionWithCookies(cookies());
  let sessionTasks: tasksType[] = [];
  let sessionContents: contentType[] = [];

  if (session) {
    sessionTasks = await db.query.tasks.findMany({
      where: eq(tasks.sessionId, session.id),
      orderBy: [desc(tasks.updatedAt)],
    });

    sessionContents = await db.query.contents.findMany({
      where: eq(tasks.sessionId, session.id),
      orderBy: [desc(sessions.createdAt)],
    });
  }

  return (
    <main className="relative flex min-h-screen flex-col  bg-[#287d7c] text-white">
      <div className="mx-auto flex flex-col items-center py-8">
        <h1 className="text-4xl font-bold ">Copyman</h1>
        <p className="text-lg">Un presse papier pas sécurisé mais pratique pour mon travail</p>
        <a href="https://mathys.in" className="no-underline text-white text-xs">
          <p className="border-dashed border-b-2 border-opacity-60 opacity-60">
            retourner sur mathys.in
          </p>
        </a>
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
