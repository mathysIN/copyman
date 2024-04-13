"use client";

import { useState, useRef } from "react";
import type { contentType } from "~/server/db/schema";
import { UploadButton } from "~/utils/uploadthing";

type contentTypeWithTimestamp = Omit<contentType, 'createdAt'> & { createdAt: number };

export default function UploadContent({
  onNewContent = () => { },
}: {
  onNewContent?: (content: contentType) => any;
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

        const newBlob = (await response.json()) as contentType;

        onNewContent(newBlob);
      }}
    >
      <div>
        <UploadButton
          endpoint="imageUploader"
          className="rounded-xl bg-white text-black"
          appearance={{ container: { color: "black" }, button: { color: "black" } }}
          onClientUploadComplete={(res) => {
            const response = res[0];
            if (!response) return;
            const _content: contentTypeWithTimestamp = response.serverData.content;
            const content: contentType = {
              ..._content,
              createdAt: new Date(_content.createdAt),
            }
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
