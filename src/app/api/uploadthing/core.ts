import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import {
  getSessionWithCookies,
  getSessionWithSessionId,
} from "~/utils/authenticate";

const f = createUploadthing();
type PropsType<F extends (input: any) => any> = Parameters<F>[0];
type dumbProp = PropsType<typeof f>;

const dumb: dumbProp = {
  image: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
  video: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
  audio: { maxFileSize: "256MB", maxFileCount: 1, minFileCount: 1 },
  blob: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
  text: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
  pdf: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
};

export const ourFileRouter = {
  imageUploader: f(dumb)
    .middleware(async ({ req }) => {
      const session = await getSessionWithCookies(req.cookies);
      if (!session) throw new UploadThingError("Unauthorized");
      return {
        sessionId: session.sessionId,
        session,
        password: session.password,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const session = await getSessionWithSessionId(
        metadata.sessionId,
        metadata.password,
      );
      if (!session) throw new UploadThingError("Unauthorized");
      const content = await session.createNewAttachment({
        attachmentPath: file.name,
        attachmentURL: file.url,
        fileKey: file.key,
      });
      if (!content || content.type != "attachment")
        throw new UploadThingError("Failed to insert content");
      return content;
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
