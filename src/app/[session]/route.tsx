import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionWithSessionId } from "~/utils/authenticate";

type Params = {
  session: string;
  password: string;
  create?: string;
};

export async function GET(request: Request, context: { params: Params }) {
  const sessionId = context.params.session;
  const createIfNull = !!context.params.create;
  let session;
  if (sessionId)
    session = await getSessionWithSessionId(
      sessionId,
      undefined,
      true,
      createIfNull,
    );
  if (session)
    cookies().set("session", sessionId, {
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });

  return redirect(`/`);
}
