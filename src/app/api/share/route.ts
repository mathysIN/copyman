import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { serverUploadFiles } from "~/app/api/content/upload/route";
import { serverCreateNote } from "~/app/api/notes/route";
import { uploadFiles } from "~/lib/client/uploadFile";
import { getSessionWithCookies } from "~/utils/authenticate";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const session = await getSessionWithCookies(cookies());
    if (!session) return NextResponse.redirect("/");
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

    return NextResponse.redirect("/");
  } catch (error) {
    console.error("Error processing share data:", error);
    return NextResponse.redirect("/");
  }
}
