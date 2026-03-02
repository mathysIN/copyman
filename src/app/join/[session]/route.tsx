import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionWithSessionId } from "~/utils/authenticate";
import { setSessionCookie } from "~/lib/cookies";

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
  if (session) setSessionCookie(cookies(), sessionId);

  return redirect(`/`);
}
