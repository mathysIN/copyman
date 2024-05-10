import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionWithSessionId } from "~/utils/authenticate";

type Params = {
  session: string;
  password: string;
};

export async function GET(request: Request, context: { params: Params }) {
  const sessionId = context.params.session;
  let session;
  if (sessionId) session = getSessionWithSessionId(sessionId, undefined, true);
  if (session)
    cookies().set("session", sessionId, {
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    });

  return redirect(`/`);
}
