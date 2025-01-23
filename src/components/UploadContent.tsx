"use client";

import { useRef } from "react";
import { AttachmentType } from "~/server/db/redis";
import { UploadDropzone, UploadButton } from "~/utils/uploadthing";
import { ClientUploadedFileData } from "uploadthing/types";
import { cn } from "~/lib/utils";
import { useToast } from "~/hooks/use-toast";
import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const UPLOADTHING_ENDPOINT = "imageUploader";

export default function UploadContent({
  onNewContent = () => {},
  className = "",
}: {
  onNewContent?: (content: AttachmentType) => any;
  className?: string;
}) {
  const { toast } = useToast();
  const onClientUploadComplete = (
    res: ClientUploadedFileData<AttachmentType>[],
  ) => {
    const response = res[0];
    if (!response) return;
    const content: AttachmentType = response.serverData;
    onNewContent(content);
  };
  const onUploadError = (error: Error) => {
    toast({
      description: `Une erreur a eu lieu lors de la mise en ligne du fichier\n\n${error.message}`,
      variant: "destructive",
    });
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
        <UploadButton
          endpoint={UPLOADTHING_ENDPOINT}
          className={cn(
            className,
            "cursor-pointer rounded-xl bg-white text-black",
          )}
          config={{ appendOnPaste: true, mode: "auto" }}
          content={{
            button({ ready }) {
              if (ready)
                return (
                  <div className="flex w-max items-center justify-center space-x-2">
                    <p>Nouveau fichier</p>
                    <FontAwesomeIcon icon={faUpload} />
                  </div>
                );
              return "Préparation...";
            },
          }}
          appearance={{
            container: { color: "black" },
            button: { color: "black" },
          }}
          onBeforeUploadBegin={(e) => {
            const file = e[0];
            toast({
              description: `Mise en ligne de ${file?.name}`,
            });
            return e;
          }}
          onClientUploadComplete={onClientUploadComplete}
          onUploadError={onUploadError}
        />
      </div>
    </form>
  );
}
