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
import { getCDNUrlFromFileKey, removeFileExtension, stringToHash } from "~/lib/utils";
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
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose } from "./ui/dialog";
import { Button } from "./ui/button";

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
  onContentDelete = () => { },
  onContentUpdate = () => { },
  socketUserId,
}: {
  content: AttachmentType;
  onContentDelete: (contentId: string) => any;
  onContentUpdate: (content: AttachmentType) => any;
  socketUserId?: string;
}) => {
  const { toast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const controls = useDragControls();
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState(content.attachmentPath);
  const [attachmentURL, setAttachmentURL] = useState(content.attachmentURL);
  const [newName, setNewName] = useState(content.attachmentPath);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setNewName(content.attachmentPath);
    setAttachmentPath(content.attachmentPath);
  }, [content.attachmentPath]);

  useEffect(() => {
    setAttachmentURL(content.attachmentURL);
  }, [content.attachmentURL]);

  const getExtension = (url: string) => {
    const urlSplited = url.split(".");
    return urlSplited[urlSplited.length - 1] ?? "";
  };

  const getContentType = (url: string) => {
    const stringExtension = getExtension(url);
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

  const contentType = getContentType(attachmentURL);


  const handleChange = async (newValue: string) => {
    await fetch(`/api/content?contentId=${content.id}&fileName=${encodeURIComponent(newValue)}`, {
      headers: {
        "X-Socket-User-Id": socketUserId ?? "",
      },
      method: "PATCH",
    }).then(() => {
      const newObject = {
        ...content,
        attachmentPath: newName,
        attachmentURL: getCDNUrlFromFileKey(newValue, content.fileKey)
      };
      setAttachmentPath(newName);
      setAttachmentURL(getCDNUrlFromFileKey(newValue, content.fileKey));
      onContentUpdate(newObject)
    });
  };


  const renderContent = () => {
    switch (contentType) {
      case "video":
        return (
          <video
            src={attachmentURL}
            controls
            className="absolute inset-0 h-full w-full object-cover"
          />
        );
      case "image":
        return (
          <PhotoView src={attachmentURL}>
            <img
              src={attachmentURL}
              alt="Content"
              className="inset-0 h-full w-full cursor-pointer rounded-lg object-cover"
            />
          </PhotoView>
        );
      case "audio":
        const index =
          Math.abs(stringToHash(content.fileKey)) % GRADIENTS.length;
        const randomGradient = GRADIENTS[index];
        return (
          <>
            <div
              className={`absolute bottom-0 left-0 right-0 top-0 z-20 mx-auto my-auto flex h-fit w-fit items-center justify-center bg-clip-text font-extrabold text-white`}
            >
              <p className="overflow-hidden text-center text-2xl">
                {removeFileExtension(attachmentPath)}
              </p>
            </div>
            <audio
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
              src={attachmentURL}
              controls
              className={`${randomGradient} ${audioPlaying && "animate-gradient"} absolute inset-0 h-full w-full bg-opacity-25 bg-[length:200%_auto] object-cover`}
            ></audio>
          </>
        );
      default:
        return <p>{attachmentPath}</p>;
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
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
    >
      <div
        className={`${deleting && "animate-pulse cursor-wait opacity-75"} ${dragging && "scale-105 shadow-2xl"} space-y h-fit rounded-md border-2 border-gray-300 bg-white p-2 text-gray-900 transition-all`}
      >
        {contentType && (
          <>
            <div
              className="relative flex h-0 w-full max-w-full justify-center"
              style={{ paddingTop: "56.25%" }}
            >
              {contentType && (
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  {renderContent()}
                </div>
              )}
            </div>
            <div className="h-2" />
          </>
        )}
        <div className="flex flex-row justify-between gap-4">
          <div className="flex flex-row gap-x-1 text-sm">
            <button
              className="w-8 rounded border-neutral-200 bg-neutral-100 py-1 active:scale-90 active:opacity-75"
              onClick={() =>
                copyAndToast(
                  toast,
                  attachmentURL,
                  "Le lien du contenu a bien été copié",
                )
              }
            >
              <FontAwesomeIcon icon={faLink} />
            </button>
            <a
              target="_blank"
              download={attachmentPath}
              href={attachmentURL}
              className="flex w-8 items-center justify-center rounded bg-neutral-100 py-1 text-gray-900 active:scale-90 active:opacity-75"
            >
              <FontAwesomeIcon icon={faDownload} />
            </a>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-8 rounded bg-red-400 py-1 text-white active:scale-90 active:opacity-75">
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
                        headers: {
                          "X-Socket-User-Id": socketUserId ?? "",
                        },
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
          <div className="flex items-center gap-2 overflow-hidden ">
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
              <DialogTrigger asChild>
                <button className="center flex-1 overflow-hidden text-right align-middle text-sm text-gray-500 sm:w-64">
                  {attachmentPath}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Renommer le fichier</DialogTitle>
                  <DialogDescription>Modifiez le nom du fichier puis appuyez sur OK.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <input
                    ref={fileNameInputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!newName || newName.trim() === "") return;
                        setRenaming(true);
                        await handleChange(newName);
                        setRenaming(false);
                        setRenameOpen(false);
                      }
                    }}
                    className="w-full rounded border px-3 py-2 text-sm"
                    type="text"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" size="sm">Annuler</Button>
                  </DialogClose>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!newName || newName.trim() === "") return;
                      setRenaming(true);
                      await handleChange(newName);
                      setRenaming(false);
                      setRenameOpen(false);
                    }}
                    disabled={renaming || !newName || newName.trim() === ""}
                  >
                    {renaming ? "Renommage..." : "OK"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
