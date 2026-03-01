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
  faFilePdf,
  faFileCode,
  faTable,
  faFileZipper,
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
  onContentDelete = () => {},
  onContentUpdate = () => {},
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
  const [textContent, setTextContent] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [textError, setTextError] = useState(false);

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
    const stringExtension = getExtension(url).toLowerCase();
    if (["mp4", "ogg", "webm"].includes(stringExtension)) return "video";
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(stringExtension))
      return "image";
    if (["mp3", "wav", "m4a", "aac"].includes(stringExtension)) return "audio";
    if (stringExtension === "pdf") return "pdf";
    if (
      [
        "txt",
        "md",
        "json",
        "js",
        "ts",
        "tsx",
        "jsx",
        "css",
        "html",
        "py",
        "rb",
        "go",
        "rs",
        "java",
        "c",
        "cpp",
        "h",
        "cs",
        "php",
        "sql",
        "yaml",
        "yml",
        "xml",
        "sh",
        "bash",
        "zsh",
      ].includes(stringExtension)
    )
      return "text";
    if (stringExtension === "csv") return "csv";
    if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(stringExtension))
      return "archive";
    // Office documents - don't try to preview as text
    if (
      [
        "docx",
        "doc",
        "xlsx",
        "xls",
        "pptx",
        "ppt",
        "odt",
        "ods",
        "odp",
      ].includes(stringExtension)
    )
      return null;
    return null;
  };

  const contentType = getContentType(attachmentURL);

  useEffect(() => {
    const loadTextContent = async () => {
      if (contentType !== "text" && contentType !== "csv") {
        setTextContent(null);
        setCsvPreview(null);
        setTextError(false);
        return;
      }

      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setTextError(true);
      }, 10000); // 10 second timeout

      try {
        let blob: Blob;
        if (
          isEncrypted &&
          encryptionKey &&
          content.encryptedIv &&
          decryptedUrl
        ) {
          const response = await fetch(decryptedUrl);
          if (!response.ok) throw new Error("Failed to fetch decrypted");
          blob = await response.blob();
        } else {
          const response = await fetch(attachmentURL);
          if (!response.ok) throw new Error("Failed to fetch");
          blob = await response.blob();
        }

        // Check if blob is too large (over 1MB for text files is suspicious)
        if (blob.size > 1024 * 1024) {
          throw new Error("File too large");
        }

        const text = await blob.text();

        // Check if content looks like binary (contains lots of null bytes or control characters)
        const nullBytes = (text.match(/\0/g) || []).length;
        if (nullBytes > 10) {
          throw new Error("Binary content");
        }

        if (contentType === "csv") {
          const lines = text.split("\n").slice(0, 6);
          const rows = lines.map((line) => line.split(",").slice(0, 4));
          setCsvPreview(rows);
        } else {
          setTextContent(text.slice(0, 300));
        }
        setTextError(false);
        clearTimeout(timeoutId);
      } catch (e) {
        clearTimeout(timeoutId);
        setTextError(true);
      }
    };

    loadTextContent();
  }, [
    contentType,
    attachmentURL,
    isEncrypted,
    encryptionKey,
    decryptedUrl,
    content.encryptedIv,
  ]);

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

  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  useEffect(() => {
    const loadDocumentContent = async () => {
      if (contentType !== "pdf" && !isHtmlFile(attachmentPath)) {
        setPdfObjectUrl(null);
        setHtmlContent(null);
        return;
      }

      try {
        let blob: Blob;
        if (
          isEncrypted &&
          encryptionKey &&
          content.encryptedIv &&
          decryptedUrl
        ) {
          const response = await fetch(decryptedUrl);
          blob = await response.blob();
        } else {
          const response = await fetch(attachmentURL);
          blob = await response.blob();
        }

        if (contentType === "pdf") {
          const url = URL.createObjectURL(blob);
          setPdfObjectUrl(url);
          return () => URL.revokeObjectURL(url);
        } else if (isHtmlFile(attachmentPath)) {
          const text = await blob.text();
          setHtmlContent(text.slice(0, 500));
        }
      } catch (e) {
        console.error("Failed to load document content:", e);
      }
    };

    loadDocumentContent();
  }, [
    contentType,
    attachmentURL,
    attachmentPath,
    isEncrypted,
    encryptionKey,
    decryptedUrl,
    content.encryptedIv,
  ]);

  const isHtmlFile = (path: string) => {
    const ext = getExtension(path).toLowerCase();
    return ext === "html" || ext === "htm";
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
      case "pdf":
        return (
          <div className="flex h-full w-full flex-col border border-red-200/60 bg-white">
            <div className="flex items-center justify-center gap-2 border-b border-red-100 bg-red-50/50 p-1.5">
              <FontAwesomeIcon
                icon={faFilePdf}
                className="h-5 w-5 text-red-500"
              />
              <span className="max-w-[150px] truncate text-xs font-medium text-gray-700">
                {attachmentPath}
              </span>
            </div>
            {pdfObjectUrl ? (
              <iframe
                src={pdfObjectUrl}
                className="min-h-0 w-full flex-1 bg-white"
                title="PDF Preview"
              />
            ) : (
              <div className="flex flex-1 items-center justify-center bg-white">
                <p className="text-xs text-slate-500">Chargement du PDF...</p>
              </div>
            )}
          </div>
        );
      case "text":
        if (textError) {
          return (
            <div className="flex h-full w-full flex-col items-center justify-center border-2 border-gray-300 bg-gray-50 p-2">
              <FontAwesomeIcon
                icon={faFileCode}
                className="h-6 w-6 text-gray-400"
              />
              <p className="mt-1 text-xs text-black">Aperçu non disponible</p>
            </div>
          );
        }
        return (
          <div className="flex h-full w-full flex-col border-2 border-gray-300 bg-white">
            <div className="flex items-center justify-center gap-2 border-b border-gray-200 bg-gray-50 p-1.5">
              <FontAwesomeIcon
                icon={faFileCode}
                className="h-5 w-5 text-blue-500"
              />
              <span className="max-w-[150px] truncate text-xs font-medium text-gray-700">
                {attachmentPath}
              </span>
            </div>
            <div className="flex-1 overflow-auto bg-white px-2 py-1">
              <pre className="w-full select-text whitespace-pre-wrap break-all bg-white text-xs text-black selection:bg-blue-200">
                {textContent || "Chargement..."}
              </pre>
            </div>
          </div>
        );
      case "csv":
        if (textError) {
          return (
            <div className="flex h-full w-full flex-col items-center justify-center border-2 border-emerald-300 bg-emerald-50 p-2">
              <FontAwesomeIcon
                icon={faTable}
                className="h-6 w-6 text-emerald-400"
              />
              <p className="mt-1 text-xs text-black">Aperçu non disponible</p>
            </div>
          );
        }
        return (
          <div className="flex h-full w-full flex-col border-2 border-emerald-300 bg-white">
            <div className="flex items-center justify-center gap-2 border-b border-emerald-200 bg-emerald-50 p-1.5">
              <FontAwesomeIcon
                icon={faTable}
                className="h-5 w-5 text-emerald-600"
              />
              <span className="max-w-[150px] truncate text-xs font-medium text-gray-700">
                {attachmentPath}
              </span>
            </div>
            <div className="flex-1 overflow-auto bg-white px-2 py-1">
              {csvPreview ? (
                <table className="w-full text-xs">
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr
                        key={i}
                        className={
                          i === 0
                            ? "bg-emerald-50 font-semibold"
                            : "hover:bg-gray-50"
                        }
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="max-w-[80px] truncate border border-gray-200 px-1 py-0.5 text-black selection:bg-emerald-200"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="w-full text-xs text-black">Chargement...</p>
              )}
            </div>
          </div>
        );
      case "archive":
      default:
        return null;
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
        {(() => {
          const rendered = renderContent();
          const isTextOrCsv = contentType === "text" || contentType === "csv";
          return rendered ? (
            <>
              <div
                className={`relative flex w-full max-w-full justify-center ${isTextOrCsv ? "min-h-[80px]" : "h-0"}`}
                style={isTextOrCsv ? {} : { paddingTop: "40%" }}
              >
                <div
                  className={`${isTextOrCsv ? "relative w-full" : "absolute inset-0"} overflow-hidden rounded-lg`}
                >
                  {rendered}
                </div>
              </div>
              <div className="h-2" />
            </>
          ) : null;
        })()}
        <div className="flex flex-row justify-between gap-4">
          <div className="flex flex-row gap-x-1 text-sm">
            <button
              aria-disabled={content.isEncrypted}
              tabIndex={content.isEncrypted ? -1 : undefined}
              className={cn(
                content.isEncrypted && "pointer-events-none text-black/40",
                "w-8 rounded border-neutral-200 bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75",
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
              className={cn(
                content.isEncrypted && "pointer-events-none text-black/40",
                "flex w-8 items-center justify-center rounded bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75",
              )}
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
