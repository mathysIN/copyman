import { cookies } from "next/headers";
import { getSessionWithCookies } from "~/utils/authenticate";
import { useRouter } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ contentid: string }>;
}) {
  const contentid = (await params).contentid;
  const session = await getSessionWithCookies(cookies()).catch(() => null);
  if (!session) return <div className="w-4/5 pb-10">Nop</div>;
  if (!contentid) return <div className="w-4/5 pb-10">Nop</div>;
  const content = await session.getContent(contentid);
  return (
    <div className="w-4/5 pb-10">
      {content?.type == "attachment" && <>{content.attachmentURL}</>}
      {content?.type == "note" && <>{content.content}</>}
    </div>
  );
}
