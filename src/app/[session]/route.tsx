import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type Params = {
  session: string;
  password: string;
};

export async function GET(request: Request, context: { params: Params }) {
  const session = context.params.session;
  cookies().set("session", session, {
    expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  });
  return redirect(`/`);
}
