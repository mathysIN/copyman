"use client";

import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { uploadFiles } from "~/lib/client/uploadFile";
import { AttachmentType } from "~/server/db/redis";

export default function Upload({
  onUploadingFiles,
  className = "",
  loading = false,
}: {
  onUploadingFiles?: (files: File[]) => any;
  className?: string;
  loading?: boolean;
}) {
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    console.log(files);
    if (!files || files.length === 0) return;

    onUploadingFiles?.(Array.from(files));
  };

  return (
    <button
      onClick={() => document.getElementById("file-upload")?.click()}
      className={`${loading ? "animate-pulse cursor-wait opacity-75" : "cursor-pointer"} flex h-16 w-full flex-col items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-black active:scale-95 active:opacity-95`}
    >
      <input
        id="file-upload"
        type="file"
        multiple
        onChange={handleUpload}
        className="hidden"
      />
      <div className="flex flex-row items-center gap-2">
        <span>{loading ? "Mise en ligne..." : "Nouveau fichier"}</span>
        <FontAwesomeIcon icon={faUpload} />
      </div>
    </button>
  );
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () =>
      resolve(reader.result?.toString().split(",")[1] || "");
    reader.onerror = reject;
  });
