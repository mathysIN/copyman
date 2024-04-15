"use client";

import { useState, useRef } from "react";
import { AttachmentType, ContentType } from "~/server/db/redis";
import { UploadButton } from "~/utils/uploadthing";

export default function UploadContent({
  onNewContent = () => {},
}: {
  onNewContent?: (content: AttachmentType) => any;
}) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  return (
    <form
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
      <div className="h-16">
        <UploadButton
          endpoint="imageUploader"
          className="h-full rounded-xl bg-white text-black"
          appearance={{
            container: { color: "black" },
            button: { color: "black" },
          }}
          onClientUploadComplete={(res) => {
            const response = res[0];
            if (!response) return;
            const content: AttachmentType = response.serverData;
            onNewContent(content);
          }}
          onUploadError={(error: Error) => {
            alert(`ERROR! ${error.message}`);
          }}
        />
      </div>
    </form>
  );
}
