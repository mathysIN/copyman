import React, { useEffect, useState } from "react";
import { contentType } from "~/server/db/schema";

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
        return <video src={content.contentURL} controls />;
      case "image":
        return <img src={content.contentURL} alt="Content" />;
      case "audio":
        return <audio src={content.contentURL} controls />;
      default:
        return <p>Unsupported content type</p>;
    }
  };

  return (
    <div className="h-fit rounded-md border-2 border-gray-200 bg-white p-2">
      {contentType && renderContent()}
      <div key={content.id} className="flex gap-x-2 text-red-500">
        <button
          onClick={() => {
            fetch(`/api/content?contentId=${content.id}`, {
              method: "DELETE",
            }).then(() => onContentDelete(content.id));
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ContentRenderer;
