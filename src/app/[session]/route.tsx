import { cookies } from 'next/headers';
import { redirect } from 'next/navigation'

type Params = {
    session: string
}

export async function GET(request: Request, context: { params: Params }) {
    const session = context.params.session;
    cookies().set("session", session);
    return redirect(`/`);
}