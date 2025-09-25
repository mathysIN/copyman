import { getSessionWithSessionId } from "~/utils/authenticate";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import Link from "next/link";

export default async function Page({
  params,
}: {
  params: { session: string; contentid: string };
}) {
  const { session: sessionId, contentid } = params;
  if (!sessionId || !contentid) return <div className="w-4/5 pb-10">Nop</div>;

  const session = await getSessionWithSessionId(sessionId, undefined, true);
  if (!session) return <div className="w-4/5 pb-10">Nop</div>;

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
        <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>
          {content.content ?? ""}
        </ReactMarkdown>
      </div>
    </div>
  );
}
