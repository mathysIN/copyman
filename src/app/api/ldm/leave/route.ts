import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = cookies();
  cookieStore.delete("session");
  cookieStore.delete("password");
  
  return NextResponse.redirect(new URL("/ldm", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
