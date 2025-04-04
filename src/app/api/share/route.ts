import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { serverCreateNote, serverUploadFiles } from "~/lib/serverUtils";
import { getSessionWithCookies } from "~/utils/authenticate";

export async function POST(req: NextRequest) {
  const protocol = req.url.split(":")[0] === "https" ? "https" : "http";
  const redirectUrl = `${protocol}://${req.headers.get("host")}/`;
  console.log(redirectUrl);
  try {
    const session = await getSessionWithCookies(cookies());
    if (!session) return NextResponse.redirect(redirectUrl, 303);
    const formData = await req.formData();
    const title = formData.get("title");
    const text = formData.get("text") as string;
    const url = formData.get("url");
    const files = formData.getAll("file");

    console.log("Received share data:", { title, text, url, files });

    if (text) {
      await serverCreateNote(session, text);
    }

    if (files && files.length > 0) {
      const fileArray = files.map((file) => file as File);
      await serverUploadFiles(session, fileArray);
    }

    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    console.error("Error processing share data:", error);
    return NextResponse.redirect(redirectUrl, 303);
  }
}
