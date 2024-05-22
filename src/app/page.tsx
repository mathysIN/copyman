import { cookies } from "next/headers";
import { PreSession } from "~/components/sessions/PreSession";
import { ActiveSession } from "~/components/sessions/ActiveSession";
import { getSessionWithCookies } from "~/utils/authenticate";
import Link from "next/link";
import { ContentType } from "~/server/db/redis";
import { Exception } from "~/utils/types";

export default async function HomePage() {
  let error: undefined | Exception;
  const session = await getSessionWithCookies(cookies()).catch((e) => {
    error = e;
    return null;
  });
  let sessionContents: ContentType[] = [];

  if (session) {
    sessionContents = await session.getAllContent();
  }

  return (
    <main className="relative flex min-h-screen flex-col  bg-[#287d7c] text-white">
      <div className="mx-auto flex flex-col items-center py-8 text-center">
        <Link href="/">
          <h1 className="text-4xl font-bold text-white no-underline ">
            Copyman
          </h1>
        </Link>
        <p className="text-lg">
          Un presse papier pas sécurisé mais pratique pour mon travail
        </p>
        <a href="https://mathys.in" className="text-xs text-white no-underline">
          <p className="border-b-2 border-dashed border-opacity-60 opacity-60">
            retourner sur mathys.in
          </p>
        </a>
      </div>
      <div className="h-12" />
      <div className="flex flex-col items-center justify-center ">
        {error && (
          <p className="text-red-500">
            Il y a eu une erreur avec les serveurs de Copyman
          </p>
        )}
        {!error && !session && <PreSession />}
        {!error && session && (
          <ActiveSession
            session={session.toJSON()}
            hasPassword={session.hasPassword()}
            sessionContents={sessionContents}
          />
        )}
      </div>
    </main>
  );
}
