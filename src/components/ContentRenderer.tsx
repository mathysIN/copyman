import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faLink,
  faTrash,
  faDownload,
  faCopy,
  faFolder,
  faArrowRightFromBracket,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import { use, useEffect, useRef, useState } from "react";
import type { AttachmentType, FolderType } from "~/server/db/redis";
import {
  cn,
  getCDNUrlFromFileKey,
  removeFileExtension,
  stringToHash,
} from "~/lib/utils";
import { decryptFile } from "~/lib/client/encryption";
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
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { MoveToFolderDialog } from "./Folder";

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
  folders,
  onMove,
  folderId,
  onMoveContentOut,
  encryptionKey,
}: {
  content: AttachmentType;
  onContentDelete: (contentId: string) => any;
  onContentUpdate: (content: AttachmentType) => any;
  socketUserId?: string;
  folders?: FolderType[];
  onMove?: (contentId: string, folderId: string | null) => void;
  folderId?: string;
  onMoveContentOut?: (contentId: string, folderId: string) => void;
  encryptionKey?: CryptoKey | null;
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
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState(false);

  const isEncrypted = content.isEncrypted && encryptionKey;
  const needsDecryption = content.isEncrypted && !encryptionKey;

  useEffect(() => {
    setNewName(content.attachmentPath);
    setAttachmentPath(content.attachmentPath);
  }, [content.attachmentPath]);

  useEffect(() => {
    setAttachmentURL(content.attachmentURL);
  }, [content.attachmentURL]);

  useEffect(() => {
    let objectUrl: string | null = null;

    const decrypt = async () => {
      if (!isEncrypted || !encryptionKey || !content.encryptedIv) {
        setDecryptedUrl(null);
        setDecryptionError(false);
        return;
      }

      console.log("[E2EE] ContentRenderer: decrypting attachment", content.id);
      try {
        const response = await fetch(content.attachmentURL);
        if (!response.ok) {
          throw new Error("Failed to fetch encrypted file");
        }
        const encryptedBlob = await response.blob();
        console.log(
          "[E2EE] ContentRenderer: fetched encrypted blob, size:",
          encryptedBlob.size,
        );

        const decryptedBlob = await decryptFile(
          encryptedBlob,
          content.encryptedIv,
          encryptionKey,
        );
        console.log(
          "[E2EE] ContentRenderer: decrypted blob, size:",
          decryptedBlob.size,
        );

        objectUrl = URL.createObjectURL(decryptedBlob);
        setDecryptedUrl(objectUrl);
        setDecryptionError(false);
        console.log(
          "[E2EE] ContentRenderer: created blob URL for decrypted content",
        );
      } catch (e) {
        console.error("[E2EE] ContentRenderer: decryption failed:", e);
        setDecryptionError(true);
        setDecryptedUrl(null);
      }
    };

    decrypt();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    content.attachmentURL,
    content.encryptedIv,
    content.id,
    encryptionKey,
    isEncrypted,
  ]);

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

  const displayUrl = isEncrypted ? decryptedUrl : attachmentURL;

  const handleDownload = async () => {
    try {
      let blob: Blob;
      if (isEncrypted && encryptionKey && content.encryptedIv && decryptedUrl) {
        const response = await fetch(decryptedUrl);
        blob = await response.blob();
      } else {
        const response = await fetch(attachmentURL);
        blob = await response.blob();
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachmentPath;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleChange = async (newValue: string) => {
    await fetch(
      `/api/content?contentId=${content.id}&fileName=${encodeURIComponent(newValue)}`,
      {
        headers: {
          "X-Socket-User-Id": socketUserId ?? "",
        },
        method: "PATCH",
      },
    ).then(() => {
      const newObject = {
        ...content,
        attachmentPath: newName,
        attachmentURL: getCDNUrlFromFileKey(newValue, content.fileKey),
      };
      setAttachmentPath(newName);
      setAttachmentURL(getCDNUrlFromFileKey(newValue, content.fileKey));
      onContentUpdate(newObject);
    });
  };

  const renderContent = () => {
    if (needsDecryption) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-yellow-100 p-4 text-center text-yellow-700">
          <FontAwesomeIcon icon={faLock} className="h-8 w-8" />
          <p className="font-medium">Fichier chiffré</p>
          <p className="text-sm">
            Activez le chiffrement avec le mot de passe pour déchiffrer ce
            fichier.
          </p>
        </div>
      );
    }

    if (isEncrypted && !decryptedUrl) {
      if (decryptionError) {
        return (
          <div className="flex h-full w-full items-center justify-center bg-red-100 text-red-600">
            <p>Erreur de déchiffrement</p>
          </div>
        );
      }
      return (
        <div className="flex h-full w-full items-center justify-center bg-gray-100">
          <p>Déchiffrement en cours...</p>
        </div>
      );
    }

    const srcUrl = displayUrl || attachmentURL;

    switch (contentType) {
      case "video":
        return (
          <video
            src={srcUrl}
            controls
            className="absolute inset-0 h-full w-full object-cover"
          />
        );
      case "image":
        if (isEncrypted && decryptedUrl) {
          return (
            <PhotoView src={decryptedUrl}>
              <img
                src={decryptedUrl}
                alt="Content"
                className="inset-0 h-full w-full cursor-pointer rounded-lg object-cover"
              />
            </PhotoView>
          );
        }
        const lowerQualityAttachment = new URL(attachmentURL);
        lowerQualityAttachment.searchParams.append("q", "60");
        return (
          <PhotoView src={attachmentURL}>
            <img
              src={lowerQualityAttachment.href}
              alt="Content"
              className="inset-0 h-full w-full cursor-pointer rounded-lg object-cover"
            />
          </PhotoView>
        );
      case "audio":
        const audioIndex =
          Math.abs(stringToHash(content.fileKey)) % GRADIENTS.length;
        const randomGradient = GRADIENTS[audioIndex];
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
              src={srcUrl}
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
              aria-disabled={content.isEncrypted}
              tabIndex={content.isEncrypted ? -1 : undefined}
              className={cn(content.isEncrypted && "pointer-events-none text-black/40", "w-8 rounded border-neutral-200 bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75"
              )}
              onClick={() =>
                copyAndToast(
                  toast,
                  attachmentURL,
                  "Le lien du contenu a bien été copié",
                )
              }
              title="Copier le lien du fichier"
            >
              <FontAwesomeIcon icon={faLink} />
            </button>
            <button
              className="flex w-8 items-center justify-center rounded bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75"
              onClick={handleDownload}
              title="Télécharger le fichier"
            >
              <FontAwesomeIcon icon={faDownload} />
            </button>
            <a
              target="_blank"
              href={attachmentURL}
              aria-disabled={content.isEncrypted}
              tabIndex={content.isEncrypted ? -1 : undefined}
              className={cn(content.isEncrypted && "pointer-events-none text-black/40", "flex w-8 items-center justify-center rounded bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75")}
              title="Ouvrir dans un nouvel onglet"
            >
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </a>

            {folders && onMove && (
              <MoveToFolderDialog
                content={content}
                folders={folders}
                onMove={onMove}
                socketUserId={socketUserId}
              />
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="w-8 rounded bg-red-400 py-1 text-white transition-colors hover:bg-red-500 active:scale-90 active:opacity-75"
                  title="Supprimer le fichier"
                >
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
                <button className="center flex-1 overflow-hidden whitespace-nowrap text-right align-middle text-sm text-gray-500 sm:w-64">
                  {attachmentPath}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Renommer le fichier</DialogTitle>
                  <DialogDescription>
                    Modifiez le nom du fichier puis appuyez sur OK.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <input
                    ref={fileNameInputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
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
                    <Button variant="outline" size="sm">
                      Annuler
                    </Button>
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
