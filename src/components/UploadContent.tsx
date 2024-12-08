"use client";

import { useRef } from "react";
import { AttachmentType } from "~/server/db/redis";
import { UploadDropzone } from "~/utils/uploadthing";
import { ClientUploadedFileData } from "uploadthing/types";
import { cn } from "~/lib/utils";

export const UPLOADTHING_ENDPOINT = "imageUploader";

export default function UploadContent({
  onNewContent = () => {},
  className = "",
}: {
  onNewContent?: (content: AttachmentType) => any;
  className?: string;
}) {
  const onClientUploadComplete = (
    res: ClientUploadedFileData<AttachmentType>[],
  ) => {
    const response = res[0];
    if (!response) return;
    const content: AttachmentType = response.serverData;
    onNewContent(content);
  };
  const onUploadError = (error: Error) => {
    alert(`ERROR! ${error.message}`);
  };

  const inputFileRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className={className}
      onSubmit={async (event) => {
        event.preventDefault();

        if (!inputFileRef.current?.files) {
          throw new Error("No file selected");
        }

        const file = inputFileRef.current.files[0];

        if (!file) return;

        const response = await fetch(`/api/content?filename=${file.name}`, {
          method: "POST",
          body: file,
        });

        inputFileRef.current.value = "";

        const newBlob = (await response.json()) as AttachmentType;

        onNewContent(newBlob);
      }}
    >
      <div className="">
        <UploadDropzone
          endpoint={UPLOADTHING_ENDPOINT}
          className={cn(
            className,
            "cursor-pointer rounded-xl bg-white text-black",
          )}
          config={{ appendOnPaste: true, mode: "auto" }}
          content={{
            button({ ready }) {
              if (ready) return <div>Upload un fichier</div>;
              return "Préparation...";
            },
          }}
          appearance={{
            label: { display: "none" },
            container: { color: "black", marginTop: 0 },
            button: { color: "black" },
          }}
          onClientUploadComplete={onClientUploadComplete}
          onUploadError={onUploadError}
        />
      </div>
    </form>
  );
}
