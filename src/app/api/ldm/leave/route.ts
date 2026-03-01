import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cookieStore = cookies();
  cookieStore.delete("session");
  cookieStore.delete("password");

  return NextResponse.redirect(new URL("/ldm", req.url));
}
