"use client";

import { $schema } from ".eslintrc.cjs";
import type { PutBlobResult } from "@vercel/blob";
import { useState, useRef } from "react";
import { contentType } from "~/server/db/schema";

export default function UploadContent({
  onNewContent = () => {},
}: {
  onNewContent?: (content: contentType) => any;
}) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [blob, setBlob] = useState<PutBlobResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | undefined>();
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();

        if (!inputFileRef.current?.files) {
          throw new Error("No file selected");
        }

        const file = inputFileRef.current.files[0];
        setCurrentFile(file);

        if (!file) return;

        const response = await fetch(`/api/content?filename=${file.name}`, {
          method: "POST",
          body: file,
        });

        inputFileRef.current.value = "";
        setCurrentFile(undefined);

        const newBlob = (await response.json()) as contentType;

        onNewContent(newBlob);
      }}
    >
      <div className="flex flex-row items-center justify-center gap-2">
        <label htmlFor="input_file">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 cursor-pointer text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            ></path>
          </svg>
        </label>
        <input
          name="file"
          ref={inputFileRef}
          type="file"
          required
          className="hidden"
          id="input_file"
          onInput={(e) => setCurrentFile(e.currentTarget.files?.[0])}
        />
        <p>{currentFile ? currentFile.name : "No file selected"}</p>
        <button
          type="submit"
          className="flex flex-col gap-2 rounded-xl bg-white px-2 py-2 text-black"
        >
          Upload
        </button>
      </div>
    </form>
  );
}
