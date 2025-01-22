import { cookies } from "next/headers";
import { PreSession } from "~/components/sessions/PreSession";
import { ActiveSession } from "~/components/sessions/ActiveSession";
import { getSessionWithCookies } from "~/utils/authenticate";
import Link from "next/link";
import { ContentOrder, ContentType } from "~/server/db/redis";
import { Exception } from "~/utils/types";

export default async function HomePage() {
  let error: undefined | Exception;
  const session = await getSessionWithCookies(cookies()).catch((e) => {
    error = e;
    return null;
  });

  let sessionContents: ContentType[] = [];
  let sessionContentOrder: ContentOrder = [];

  if (session) {
    sessionContents = await session.getAllContent();
    sessionContentOrder = await session.getContentOrder();
  }

  const showingSession = !error && session;

  return (
    <main className="relative flex min-h-screen flex-col  bg-[#287d7c] text-white">
      <div className="mx-auto flex flex-col items-center py-8 text-center">
        <Link href="/">
          <h1 className="text-4xl font-bold text-white no-underline ">
            Copyman
          </h1>
        </Link>
        {!showingSession && (
          <>
            <p className="py-2 text-lg">
              {MOTDS[Math.floor(Math.random() * MOTDS.length)]}
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col items-center justify-center ">
        {error && (
          <p className="text-red-500">
            Il y a eu une erreur avec les serveurs de Copyman
          </p>
        )}
        {!showingSession && <PreSession />}
        {showingSession && (
          <ActiveSession
            session={session.toJSON()}
            hasPassword={session.hasPassword()}
            sessionContents={sessionContents}
            sessionContentOrder={sessionContentOrder}
          />
        )}
      </div>
    </main>
  );
}

const MOTDS = [
  "5 balles de bounty à celui qui trouve une faille",
  '"Mais Apple UC et AirDrop existe déjà", haha men fou',
  "Un presse papier pas sécurisé mais pratique pour mon travail",
  "L'application qui tourne sur un spaghetti code",
];
