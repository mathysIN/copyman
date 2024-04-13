"use client";

import { $schema } from ".eslintrc.cjs";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { PutBlobResult } from "@vercel/blob";
import { useState, useRef } from "react";
import type { contentType } from "~/server/db/schema";

export default function UploadContent({
  onNewContent = () => { },
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
      <div className="flex flex-row items-center gap-2">
        <label htmlFor="input_file" className="cursor-pointer">
          <FontAwesomeIcon icon={faPlus} />
        </label>
        <label htmlFor="input_file" className="cursor-pointer">
          <p className="cursor-pointer">{currentFile ? currentFile.name : "Selectionner un fichier"}</p>
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
        <button
          type="submit"
          className={`${!currentFile && "opacity-75 cursor-not-allowed"} flex flex-col gap-2 rounded-xl bg-white px-2 py-2 text-black`}
          disabled={!currentFile}
        >
          Envoyer
        </button>
      </div>
    </form>
  );
}
