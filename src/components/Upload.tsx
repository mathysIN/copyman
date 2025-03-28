"use client";

import { faUpload } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { uploadFiles } from "~/lib/client/uploadFile";
import { AttachmentType } from "~/server/db/redis";

interface Props {
  className?: string;
}

export default function Upload({
  onNewContent = () => {},
  className = "",
}: {
  onNewContent?: (content: AttachmentType[]) => any;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    const attachments = await uploadFiles(Array.from(files));
    setUploading(false);
    if (!attachments) return;
    onNewContent(attachments);
  };

  return (
    <button
      onClick={() => document.getElementById("file-upload")?.click()}
      className={`${uploading ? "animate-pulse cursor-wait opacity-75" : "cursor-pointer"} flex h-16 w-full flex-col items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-black active:scale-95 active:opacity-95`}
    >
      <input
        id="file-upload"
        type="file"
        multiple
        onChange={handleUpload}
        className="hidden"
      />
      <div className="flex flex-row items-center gap-2">
        <span>{uploading ? "Mise en ligne..." : "Nouveau fichier"}</span>
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
