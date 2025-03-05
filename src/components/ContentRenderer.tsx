import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faLink,
  faTrash,
  faDownload,
  faCopy,
} from "@fortawesome/free-solid-svg-icons";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { use, useEffect, useRef, useState } from "react";
import type { AttachmentType } from "~/server/db/redis";
import { removeFileExtension, stringToHash } from "~/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { copyAndToast } from "~/lib/client/toast";
import { useToast } from "~/hooks/use-toast";
import { Reorder, useDragControls } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";

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
  const { toast } = useToast();
  const [isHolding, setIsHolding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [contentType, setContentType] = useState<
    "video" | "image" | "audio" | null
  >(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const controls = useDragControls();

  const getContentType = (url: string) => {
    const urlSplited = url.split(".");
    const stringExtension = urlSplited[urlSplited.length - 1] ?? "";
    let extension: "video" | "image" | "audio" | null = null;
    if (["mp4", "ogg", "webm"].includes(stringExtension)) {
      extension = "video";
    } else if (["png", "jpg", "jpeg", "gif", "svg"].includes(stringExtension)) {
      extension = "image";
    } else if (["mp3", "wav"].includes(stringExtension)) {
      extension = "audio";
    }
    return extension;
  };

  useEffect(() => {
    setContentType(getContentType(content.attachmentPath));
  }, [content]);

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
          <PhotoProvider>
            <PhotoView src={content.attachmentURL}>
              <img
                src={content.attachmentURL}
                alt="Content"
                className="inset-0 h-full w-full cursor-pointer rounded-lg object-cover"
              />
            </PhotoView>
          </PhotoProvider>
        );
      case "audio":
        const index =
          Math.abs(stringToHash(content.attachmentURL)) % GRADIENTS.length;
        const randomGradient = GRADIENTS[index];
        return (
          <>
            <div
              className={`absolute bottom-0 left-0 right-0 top-0 z-20 mx-auto my-auto flex h-fit w-fit items-center justify-center bg-clip-text font-extrabold text-white`}
            >
              <p className="overflow-hidden text-center text-2xl">
                {removeFileExtension(content.attachmentPath)}
              </p>
            </div>
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
    <Reorder.Item
      key={content.id}
      value={content}
      drag="y"
      layoutScroll={true}
      dragControls={controls}
      dragListener={isHolding}
    >
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
        <div className="flex flex-row justify-between gap-4">
          <div className="flex flex-row gap-x-2">
            <button
              className="active:scale-95"
              onClick={() => copyAndToast(toast, content.attachmentURL)}
            >
              <FontAwesomeIcon icon={faLink} />
            </button>
            <a
              href={content.attachmentURL}
              className="flex items-center justify-center text-gray-900 active:scale-95"
              target="_blank"
            >
              <FontAwesomeIcon icon={faDownload} />
            </a>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-red-400 active:scale-95">
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Suppression : êtes-vous sûr ?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action ne pourra pas être annulée. Le contenu sera
                    définitivement retiré des serveurs de Copyman.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    autoFocus
                    onClick={async () => {
                      setDeleting(true);
                      await fetch(`/api/content?contentId=${content.id}`, {
                        method: "DELETE",
                      }).then(() => onContentDelete(content.id));
                      setDeleting(false);
                    }}
                  >
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex select-text items-center gap-2 overflow-hidden ">
            <p className="center flex-1 overflow-hidden whitespace-nowrap text-right  align-middle text-sm text-gray-500 sm:w-64">
              {content.attachmentPath}
            </p>
            <div
              className="flex cursor-grab touch-none flex-row items-center justify-center"
              onPointerDown={(e) => controls?.start(e)}
            >
              <div className=" mt-[1px] cursor-grab">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-black"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="5" cy="6" r="1.5" />
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="5" cy="18" r="1.5" />
                  <circle cx="10" cy="6" r="1.5" />
                  <circle cx="10" cy="12" r="1.5" />
                  <circle cx="10" cy="18" r="1.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
};

export default ContentRenderer;
