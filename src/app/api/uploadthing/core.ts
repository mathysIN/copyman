import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { db } from "~/server/db";
import { contents } from "~/server/db/schema";
import { getSessionWithCookies } from "~/utils/authenticate";

const f = createUploadthing();
type PropsType<F extends (input: any) => any> = Parameters<F>[0];
type dumbProp = PropsType<typeof f>;

const dumb: dumbProp = {
    image: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
    video: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
    audio: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
    blob: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
    text: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
    pdf: { maxFileSize: "64MB", maxFileCount: 1, minFileCount: 1 },
};

export const ourFileRouter = {
    imageUploader: f(dumb)
        .middleware(async ({ req }) => {
            const session = await getSessionWithCookies(req.cookies);
            if (!session) throw new UploadThingError("Unauthorized");
            return { sessionId: session.id };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            const response = await db
                .insert(contents)
                .values({
                    pathname: file.name,
                    sessionId: metadata.sessionId,
                    contentURL: file.url,
                    fileKey: file.key
                })
                .returning();
            const content = response[0];
            if (!content) throw new UploadThingError("Failed to insert content");
            return {
                uploadedBy: metadata.sessionId, content: {
                    pathname: content.pathname,
                    sessionId: content.sessionId,
                    contentURL: content.contentURL,
                    id: content.id,
                    fileKey: content.fileKey,
                    createdAt: content.createdAt.getTime()
                }
            };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;