import { cookies } from "next/headers";
import { PreSession } from "~/components/sessions/PreSession";
import { ActiveSession } from "~/components/sessions/ActiveSession";
import Link from "next/link";
import { getSessionWithCookies } from "~/utils/authenticate";
import { type ContentOrder, type ContentType } from "~/server/db/redis";
import { type Exception } from "~/utils/types";

export default async function HomePage() {
  console.log("[DEBUG PAGE] loading page");
  const startTotal = performance.now();

  let error: undefined | Exception;

  const startSession = performance.now();
  const session = await getSessionWithCookies(cookies()).catch((e) => {
    error = e;
    return null;
  });
  console.log(
    `[DEBUG PAGE] getSessionWithCookies: ${(performance.now() - startSession).toFixed(2)}ms`,
  );

  let sessionContents: ContentType[] = [];
  let sessionContentOrder: ContentOrder = [];

  if (session) {
    const startContent = performance.now();
    sessionContents = await session.getAllContent();
    console.log(
      `[DEBUG PAGE] getAllContent (${sessionContents.length} items): ${(performance.now() - startContent).toFixed(2)}ms`,
    );

    const startOrder = performance.now();
    sessionContentOrder = await session.getContentOrder();
    console.log(
      `[DEBUG PAGE] getContentOrder (${sessionContentOrder.length} items): ${(performance.now() - startOrder).toFixed(2)}ms`,
    );
  }

  console.log(
    `[DEBUG PAGE] TOTAL: ${(performance.now() - startTotal).toFixed(2)}ms`,
  );
  const bgImageURL = session?.imageBackground;

  const showingSession = !error && session;

  console.log("page loaded");
  return (
    <>
      <div
        className="absolute -z-10 h-full w-full"
        style={{
          background: `url('${bgImageURL}'), black`,
          backgroundSize: "cover",
        }}
      ></div>
      <main className="relative flex min-h-screen flex-col text-white backdrop-blur-md">
        <div className="mx-auto flex flex-col items-center py-8 pb-4 text-center">
          <Link href="/">
            <h1 className="text-4xl font-bold text-white no-underline ">
              Copyman
            </h1>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center ">
          {error && (
            <p className="text-red-500">
              Il y a eu une erreur avec les serveurs de Copyman
            </p>
          )}
          {!showingSession && <PreSession />}
          {!showingSession && (
            <p className="offline-only mt-4 text-sm opacity-80">
              Vous êtes hors ligne. Connectez-vous pour rejoindre ou créer une
              session.
            </p>
          )}
          {showingSession && (
            <ActiveSession
              session={session.toJSON()}
              baseHasPassword={session.hasPassword()}
              baseSessionContent={sessionContents}
              sessionContentOrder={sessionContentOrder}
            />
          )}
        </div>
      </main>
    </>
  );
}
