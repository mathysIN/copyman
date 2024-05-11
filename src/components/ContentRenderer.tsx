import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faLink,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

import { useEffect, useRef, useState } from "react";
import type { AttachmentType } from "~/server/db/redis";
import { removeFileExtension, stringToHash } from "~/lib/utils";

const GRADIENTS = [
  "bg-gradient-to-r from-green-400 to-blue-500",
  "bg-gradient-to-r from-pink-500 to-yellow-500",
  "bg-gradient-to-r from-yellow-400 to-red-500",
  "bg-gradient-to-r from-indigo-400 to-purple-500",
  "bg-gradient-to-r from-red-400 to-pink-500",
  "bg-gradient-to-r from-blue-400 to-green-500",
  "bg-gradient-to-r from-purple-400 to-indigo-500",
  "bg-gradient-to-r from-teal-400 to-blue-500",
  "bg-gradient-to-r from-orange-400 to-red-500",
  "bg-gradient-to-r from-cyan-400 to-blue-500",
  "bg-gradient-to-r from-rose-400 to-pink-500",
  "bg-gradient-to-r from-lime-400 to-green-500",
];

const ContentRenderer = ({
  content,
  onContentDelete = () => {},
}: {
  content: AttachmentType;
  onContentDelete: (contentId: string) => any;
}) => {
  const [deleting, setDeleting] = useState(false);
  const [contentType, setContentType] = useState<
    "video" | "image" | "audio" | null
  >(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Function to determine the content type based on the URL
  const getContentType = (url: string) => {
    if (url.match(/\.(mp4|ogg|webm)$/)) {
      return "video";
    } else if (url.match(/\.(png|jpg|jpeg|gif)$/)) {
      return "image";
    } else if (url.match(/\.(mp3|wav)$/)) {
      return "audio";
    } else {
      return null;
    }
  };

  // Update the content type state when the component mounts
  useEffect(() => {
    setContentType(getContentType(content.attachmentURL));
  }, [content]);

  // Render different content based on the content type
  const renderContent = () => {
    switch (contentType) {
      case "video":
        return (
          <video
            src={content.attachmentURL}
            controls
            className="absolute inset-0 h-full w-full object-cover"
          />
        );
      case "image":
        return (
          <img
            src={content.attachmentURL}
            alt="Content"
            className="absolute inset-0 h-full w-full rounded-lg object-cover"
          />
        );
      case "audio":
        const index =
          Math.abs(stringToHash(content.attachmentURL)) % GRADIENTS.length;
        const randomGradient = GRADIENTS[index];
        return (
          <>
            <p
              className={`${randomGradient} absolute bottom-0 left-0 right-0 top-0 z-20 mx-auto my-auto flex h-max w-max items-center justify-center bg-clip-text font-extrabold text-white`}
            >
              <p className="overflow-hidden text-center text-4xl">
                {removeFileExtension(content.attachmentPath)}
              </p>
            </p>
            <audio
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
              src={content.attachmentURL}
              controls
              className={`${randomGradient} ${audioPlaying && "animate-gradient"} absolute inset-0 h-full w-full bg-opacity-25 bg-[length:200%_auto] object-cover`}
            ></audio>
          </>
        );
      default:
        return <p>{content.attachmentPath}</p>;
    }
  };

  return (
    <div
      className={`${deleting && "animate-pulse cursor-wait opacity-75"} space-y h-fit rounded-md border-2 border-gray-300 bg-white p-2 text-gray-900`}
    >
      {contentType && (
        <>
          <div
            className="relative flex h-0 w-full max-w-full justify-center"
            style={{ paddingTop: "56.25%" }}
          >
            {contentType && (
              <div className="absolute inset-0 overflow-hidden">
                {renderContent()}
              </div>
            )}
          </div>
          <div className="h-2" />
        </>
      )}
      <div className="flex flex-row items-center gap-4">
        <div key={content.id} className="z-10 flex gap-x-2">
          <button
            onClick={() => navigator.clipboard.writeText(content.attachmentURL)}
          >
            <FontAwesomeIcon icon={faLink} />
          </button>
          <a href={content.attachmentURL} target="_blank">
            <button className="text-gray-900">
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </button>
          </a>
          <button
            className="text-red-400"
            onClick={async () => {
              setDeleting(true);
              await fetch(`/api/content?contentId=${content.id}`, {
                method: "DELETE",
              }).then(() => onContentDelete(content.id));
              setDeleting(false);
            }}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>

        <p className="center flex-1 overflow-scroll whitespace-nowrap text-right  align-middle text-sm text-gray-500 sm:w-64">
          {content.attachmentPath}
        </p>
      </div>
    </div>
  );
};

export default ContentRenderer;
