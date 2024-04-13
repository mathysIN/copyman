import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faLink,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

import { useEffect, useState } from "react";
import type { contentType } from "~/server/db/schema";

const ContentRenderer = ({
  content,
  onContentDelete = () => {},
}: {
  content: contentType;
  onContentDelete: (contentId: number) => any;
}) => {
  const [contentType, setContentType] = useState<
    "video" | "image" | "audio" | null
  >(null);

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
    setContentType(getContentType(content.contentURL));
  }, [content]);

  // Render different content based on the content type
  const renderContent = () => {
    switch (contentType) {
      case "video":
        return (
          <video
            src={content.contentURL}
            controls
            className="absolute inset-0 h-full w-full object-cover"
          />
        );
      case "image":
        return (
          <img
            src={content.contentURL}
            alt="Content"
            className="absolute inset-0 h-full w-full rounded-lg object-cover"
          />
        );
      case "audio":
        return (
          <audio
            src={content.contentURL}
            controls
            className="absolute inset-0 h-full w-full object-cover"
          />
        );
      default:
        return <p>{content.pathname}</p>;
    }
  };

  return (
    <div className="space-y h-fit rounded-md border-2 border-gray-300 bg-white p-2 text-gray-900">
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
            onClick={() => navigator.clipboard.writeText(content.contentURL)}
          >
            <FontAwesomeIcon icon={faLink} />
          </button>
          <a href={content.contentURL} target="_blank">
            <button className="text-gray-900">
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </button>
          </a>
          <button
            className="text-red-400"
            onClick={() => {
              fetch(`/api/content?contentId=${content.id}`, {
                method: "DELETE",
              }).then(() => onContentDelete(content.id));
            }}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>

        <p className="center flex-1 overflow-scroll whitespace-nowrap text-right  align-middle text-sm text-gray-500 sm:w-64">
          {content.pathname}
        </p>
      </div>
    </div>
  );
};

export default ContentRenderer;
