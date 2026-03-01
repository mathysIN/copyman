import { getSessionWithSessionId } from "~/utils/authenticate";
import { cookies } from "next/headers";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { cn } from "~/lib/utils";

export default async function Page({
  params,
}: {
  params: { session: string; contentid: string };
}) {
  const { session: sessionId, contentid } = params;
  if (!sessionId || !contentid) return <div className="w-4/5 pb-10">Nop</div>;

  // Try to authenticate using session token from cookies
  const sessionToken = cookies().get("session_token")?.value;
  const password = cookies().get("password")?.value;

  // DO NOT bypass password - require authentication
  // First try session token auth (doesn't need password)
  let session = null;
  if (sessionToken) {
    session = await getSessionWithSessionId(sessionId, undefined);
    if (session) {
      const { verifySessionToken } = await import("~/server/db/redis");
      const isValid = await verifySessionToken(session.sessionId, sessionToken);
      if (!isValid) {
        session = null;
      }
    }
  }

  // If no valid session token, try password
  if (!session) {
    session = await getSessionWithSessionId(sessionId, password);
  }

  if (!session)
    return (
      <div className="w-4/5 pb-10">
        Session not found or authentication required
      </div>
    );

  const content = await session.getContent(contentid);
  if (!content || content.type !== "note")
    return <div className="w-4/5 pb-10">Nop</div>;

  return (
    <div className="flex flex-col items-center gap-6 p-10">
      <div className="mx-auto flex flex-col items-center text-center">
        <Link href="/">
          <h1 className="text-4xl font-bold text-white no-underline ">
            Copyman
          </h1>
        </Link>
      </div>
      <Link
        href={`/join/${session.sessionId}`}
        className="cursor-pointer text-xl text-white"
      >
        #{session.sessionId}
      </Link>
      <div className="w-full rounded-md border border-gray-200 bg-white p-4 text-gray-900 shadow-sm">
        <ReactMarkdown
          remarkPlugins={[remarkBreaks, remarkGfm]}
          children={
            content.content?.replace(/(?<=\n\n)(?![*-])/gi, "&nbsp;\n ") ?? ""
          }
          components={{
            ul({ node, children, className, ...props }) {
              return (
                <ul className={cn(className, "list-disc pl-5")} {...props}>
                  {children}
                </ul>
              );
            },
            a({ node, children, className, ...props }) {
              return (
                <a
                  {...props}
                  className={cn(className, "cursor-pointer underline")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              );
            },
            pre({ node, children, className, ...props }) {
              return (
                <div className="relative">
                  <pre
                    className={cn(className, "overflow-x-scroll")}
                    {...props}
                  >
                    <br />
                    {children}
                    <br />
                  </pre>
                </div>
              );
            },
            code({ node, children, ...props }) {
              return <>{children}</>;
            },
          }}
        />
      </div>
    </div>
  );
}
