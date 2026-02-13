"use client";

import {
  faEye,
  faPerson,
  faUser,
  faWarning,
  faWifi,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddNewTask, type AddNewTaskRef } from "~/components/AddNewTask";
import ContentRenderer from "~/components/ContentRenderer";
import { Task as Note } from "~/components/Task";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { socket } from "~/lib/client/socket";
import {
  deleteAllCookies,
  sortAttachments,
  toPlural,
  uuidv4Insecure,
} from "~/lib/utils";
import {
  type AttachmentType,
  type ContentOrder,
  type ContentType,
  type NoteType,
  type SessionType,
  type FolderType,
} from "~/server/db/redis";
import { Folder, CreateFolderButton } from "~/components/Folder";
import { PasteButton } from "~/components/PasteButton";
import { Reorder } from "framer-motion";
import { useToast } from "~/hooks/use-toast";
import { DialogClose } from "@radix-ui/react-dialog";
import { type User } from "~/server";
import Upload from "~/components/Upload";
import { uploadFiles as realUploadFile } from "~/lib/client/uploadFile";
import { api } from "~/utils/api";
import { Progress } from "../ui/progress";
import autoAnimate from "@formkit/auto-animate";
import {
  loadOfflineSession,
  saveOfflineSession,
} from "~/lib/client/offlineStore";
import { PhotoProvider } from "react-photo-view";
import { UAParser } from "ua-parser-js";
import { copyAndToast } from "~/lib/client/toast";

type UploadProgress = {
  id: string;
  progress: number;
  state: "active" | "error";
  erroredAt?: Date;
  finishedAt?: Date;
  filename: string;
};

export function ActiveSession({
  session,
  baseSessionContent,
  baseHasPassword,
  sessionContentOrder,
}: {
  session: SessionType;
  baseSessionContent: ContentType[];
  baseHasPassword: boolean;
  sessionContentOrder: ContentOrder;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [roomUsers, setRoomUsers] = useState<User[]>([]);
  const [uploadProgressPourcentage, setUploadProgressPourcentage] = useState<
    UploadProgress[]
  >([]);
  const [uploadPasteLoading, setUploadPasteLoading] = useState(false);

  const [hasPassword, setHasPassword] = useState(baseHasPassword);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalContent, setPasswordModalContent] = useState("");
  const [socketUserId, setSocketUserId] = useState<string | undefined>(
    undefined,
  );
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [bgModalContent, setBgModalContent] = useState(
    session.backgroundImageURL ?? "",
  );
  const [bgModalLoading, setBgModalLoading] = useState(false);
  const [contentOrder, setContentOrder] = useState<ContentOrder>([
    ...new Set(sessionContentOrder),
  ]);
  const [sessionContent, setSessionContent] =
    useState<ContentType[]>(baseSessionContent);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [changeSessionOpen, setChangeSessionOpen] = useState(false);
  const [changeSessionValue, setChangeSessionValue] = useState("");
  const [changePasswordValue, setChangePasswordValue] = useState("");
  const [changeSessionError, setChangeSessionError] = useState("");
  const [changeSessionLoading, setChangeSessionLoading] = useState(false);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [deletedModalOpen, setDeletedModalOpen] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);
  const warnedSessionIdRef = useRef<string | null>(null);

  const [showTrucs, setShowTrucs] = useState(true);
  const [showAutresTrucs, setShowAutresTrucs] = useState(true);
  const containerAnimationUploadingRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    containerAnimationUploadingRef.current &&
      autoAnimate(containerAnimationUploadingRef.current);
  }, [containerAnimationUploadingRef]);

  const newTaskComponent = useRef<AddNewTaskRef>(null);

  const lastHelloSocketIdRef = useRef<string | null>(null);

  function onConnect(): void {
    console.log("connected to socket");
  }

  function onWelcome(socketUserId: string): void {
    console.log("welcome!");
    setIsConnected(true);
    setSocketUserId(socketUserId);
    socket.emit("hello");
  }

  function onDisconnect(): void {
    setIsConnected(false);
  }

  function onNewContent(content: ContentType[], emit = true): void {
    if (emit) socket.emit("addContent", content);
    setSessionContent((prev) => {
      const newContent = content.filter(
        (c) => !prev.some((p) => p.id === c.id),
      );
      const next = [...newContent, ...prev];
      void saveOfflineSession({
        sessionId: session.sessionId,
        content: next,
        order: contentOrder,
        updatedAt: Date.now(),
      });
      return next;
    });
  }

  function onContentRename(
    contentId: string,
    newName: string,
    emit = true,
  ): void {
    if (emit) socket.emit("deleteContent", contentId);
    setSessionContent((prev) => {
      const next = prev.filter((c) => c.id !== contentId);

      void saveOfflineSession({
        sessionId: session.sessionId,
        content: next,
        order: contentOrder,
        updatedAt: Date.now(),
      });
      return next;
    });
  }

  function onDeleteContent(contentId: string, emit = true): void {
    if (emit) socket.emit("deleteContent", contentId);
    setSessionContent((prev) => {
      const next = prev.filter((c) => c.id !== contentId);

      void saveOfflineSession({
        sessionId: session.sessionId,
        content: next,
        order: contentOrder,
        updatedAt: Date.now(),
      });
      return next;
    });
  }

  function onUpdateContentOrder(order: ContentOrder, emit = true): void {
    const deduplicatedOrder = [...new Set(order)];
    if (emit) socket.emit("updatedContentOrder", deduplicatedOrder);
    setContentOrder(deduplicatedOrder);
    void saveOfflineSession({
      sessionId: session.sessionId,
      content: sessionContent,
      order: deduplicatedOrder,
      updatedAt: Date.now(),
    });
  }

  function onRoomInsight(room: { users: User[] }): void {
    setRoomUsers(room.users);
  }

  function onUpdateContent(content: ContentType, emit = true): void {
    if (emit) socket.emit("updatedContent", content);
    else {
      const index = sessionContent.findIndex((c) => c.id == content.id);
      if (!index && !sessionContent[index]) throw "Client unsynced with server";
      setSessionContent((prev) => {
        const next = prev.map((c) => (c.id == content.id ? content : c));
        void saveOfflineSession({
          sessionId: session.sessionId,
          content: next,
          order: contentOrder,
          updatedAt: Date.now(),
        });
        return next;
      });
    }
  }

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    (async () => {
      if (!navigator.onLine) {
        const local = await loadOfflineSession<ContentType, ContentOrder>(
          session.sessionId,
        );
        if (local) {
          setSessionContent(local.content);
          setContentOrder(local.order);
        }
      }
    })();

    setIsConnected(socket.connected);
    if (socket.connected) {
      onConnect();
    }

    socket.on("updatedContent", (content) => onUpdateContent(content, false));

    socket.on("addContent", (content) => {
      onNewContent(content, false);
    });

    socket.on("deleteContent", (contentId) => {
      onDeleteContent(contentId, false);
    });

    socket.on("updatedContentOrder", (order) => {
      onUpdateContentOrder(order, false);
    });

    socket.on("roomInsight", (room) => {
      onRoomInsight(room);
    });

    socket.on("sessionWarning", () => {
      if (warnedSessionIdRef.current !== session.sessionId) {
        setWarningModalOpen(true);
        warnedSessionIdRef.current = session.sessionId;
      }
    });

    socket.on("sessionDeleted", () => {
      setDeletedModalOpen(true);
      deleteAllCookies();
    });

    socket.on("connect", onConnect);
    socket.on("welcome", onWelcome);
    socket.on("disconnect", onDisconnect);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      socket.off("updatedContent");
      socket.off("addContent");
      socket.off("deleteContent");
      socket.off("updatedContentOrder");
      socket.off("roomInsight");
      socket.off("sessionWarning");
      socket.off("sessionDeleted");
      socket.off("connect");
      socket.off("welcome");
      socket.off("disconnect");
    };
  }, []);

  function onUploadingFiles(files: File[]) {
    uploadFiles(Array.from(files));
  }

  function onPasteGlobal(event: ClipboardEvent): void {
    const activeElement = document.activeElement as HTMLElement;

    if (
      activeElement.tagName !== "TEXTAREA" &&
      activeElement.tagName !== "INPUT"
    ) {
      const clipboardData = event.clipboardData;
      if (clipboardData) {
        uploadClipboardData(clipboardData);
      }
    }
  }

  function onDragOver(e: DragEvent): void {
    e.preventDefault();
  }

  async function onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files) await uploadFiles(Array.from(files));
  }

  async function uploadClipboardData(
    clipboardData: DataTransfer,
  ): Promise<void> {
    const text = clipboardData.getData("text");
    if (text) {
      newTaskComponent.current?.addTask(text);
    }

    const attachments: AttachmentType[] = [];
    const files: File[] = [];
    for (const item of clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        files.push(file);
      }
    }
    uploadFiles(files);
  }

  async function pasteImagesFromClipboard() {
    try {
      setUploadPasteLoading(true);
      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];

      for (const item of clipboardItems) {
        const imageTypes = item.types.filter((type) =>
          type.startsWith("image/"),
        );
        for (const type of imageTypes) {
          const blob = await item.getType(type);
          files.push(
            new File(
              [blob],
              `pasted-image-${Date.now()}.${type.split("/")[1]}`,
              { type },
            ),
          );
        }
      }

      if (files.length > 0) {
        uploadFiles(files);
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    } finally {
      setUploadPasteLoading(false);
    }
  }

  async function uploadFiles(files: File[]): Promise<AttachmentType[] | null> {
    const uploadId = crypto?.randomUUID?.() ?? uuidv4Insecure();

    const uploadedFiles = await realUploadFile(
      files,
      (progress: number) => {
        const firstFile = files[0];
        if (!firstFile) return;
        setUploadProgressPourcentage((prev) => {
          const next = [...prev];

          const index = next.findIndex((p) => p.id === uploadId);
          const previous = next[index];

          if (previous) {
            if (progress >= 100 && !previous.finishedAt) {
              previous.finishedAt = new Date();
            }
            if (!previous.finishedAt) {
              previous.finishedAt = new Date();
            }
            next[index] = { ...previous, finishedAt: new Date(), progress };
          } else {
            let uploadName: string;
            if (files.length == 1) {
              uploadName = firstFile.name;
            } else {
              uploadName = `${files.length} fichiers`;
            }
            next.push({
              filename: uploadName,
              id: uploadId,
              progress: progress,
              state: "active",
            });
          }

          return next;
        });
      },
      socketUserId,
    );

    setUploadProgressPourcentage((prev) => {
      const next = [...prev];
      const index = next.findIndex((p) => p.id === uploadId);
      next.splice(index, 1);
      return next;
    });

    if (uploadedFiles) onNewContent(uploadedFiles);
    return uploadedFiles;
  }

  useEffect(() => {
    document.addEventListener("paste", onPasteGlobal);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);

    return () => {
      document.removeEventListener("paste", onPasteGlobal);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  // Get folders and content
  const folders: FolderType[] = sessionContent
    .filter((c: ContentType): c is FolderType => c.type === "folder")
    .sort((a, b) => sortAttachments(a, b, contentOrder));

  const attachmentFolders = folders.filter(
    (f) => f.targetType === "attachment",
  );
  const noteFolders = folders.filter((f) => f.targetType === "note");

  // Get root-level content (not in folders)
  const attachmentContent: AttachmentType[] = sessionContent
    .filter(
      (c: ContentType): c is AttachmentType =>
        c.type === "attachment" && !c.folderId,
    )
    .sort((a, b) => sortAttachments(a, b, contentOrder));

  const noteContent: NoteType[] = sessionContent
    .filter((c: ContentType): c is NoteType => c.type === "note" && !c.folderId)
    .sort((a, b) => sortAttachments(a, b, contentOrder));

  // Get content inside folders
  const getFolderContents = (folderId: string): ContentType[] => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return [];

    return sessionContent
      .filter(
        (c) =>
          (c.type === "attachment" || c.type === "note") &&
          c.folderId === folderId,
      )
      .sort((a, b) => {
        const indexA = folder.contentIds.indexOf(a.id);
        const indexB = folder.contentIds.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA === -1 && indexB === -1)
          return parseInt(b.createdAt) - parseInt(a.createdAt);
        if (indexA === -1) return 1;
        return -1;
      });
  };

  // Folder management functions
  function onCreateFolder(folder: FolderType): void {
    setSessionContent((prev) => [...prev, folder]);
    const newOrder = [folder.id, ...contentOrder];
    setContentOrder(newOrder);
    onUpdateContentOrder(newOrder, true);
  }

  function onUpdateFolder(folder: FolderType): void {
    setSessionContent((prev) =>
      prev.map((c) => (c.id === folder.id ? folder : c)),
    );
  }

  function onDeleteFolder(folderId: string): void {
    // Move all content out of folder first
    setSessionContent((prev) =>
      prev.map((c) => {
        if (
          (c.type === "attachment" || c.type === "note") &&
          c.folderId === folderId
        ) {
          return { ...c, folderId: undefined };
        }
        return c;
      }),
    );

    // Then remove the folder
    setSessionContent((prev) => prev.filter((c) => c.id !== folderId));
  }

  function onReorderFolderContents(
    folderId: string,
    newContents: ContentType[],
  ): void {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const newContentIds = newContents.map((c) => c.id);
    const updatedFolder = { ...folder, contentIds: newContentIds };

    setSessionContent((prev) =>
      prev.map((c) => (c.id === folderId ? updatedFolder : c)),
    );

    // Emit socket event
    socket.emit("updatedContent", updatedFolder);
  }

  function onMoveContentToFolder(
    contentId: string,
    folderId: string | null,
  ): void {
    setSessionContent((prev) =>
      prev.map((c) => {
        if (
          c.id === contentId &&
          (c.type === "attachment" || c.type === "note")
        ) {
          return { ...c, folderId };
        }
        return c;
      }),
    );

    // If moving into a folder, update the folder's contentIds
    if (folderId) {
      const folder = folders.find((f) => f.id === folderId);
      if (folder && !folder.contentIds.includes(contentId)) {
        const updatedFolder = {
          ...folder,
          contentIds: [...folder.contentIds, contentId],
        };
        setSessionContent((prev) =>
          prev.map((c) => (c.id === folderId ? updatedFolder : c)),
        );
        socket.emit("updatedContent", updatedFolder);
      }
    }

    // If moving out of a folder, remove from that folder's contentIds
    const content = sessionContent.find((c) => c.id === contentId);
    if (
      content &&
      (content.type === "attachment" || content.type === "note") &&
      content.folderId
    ) {
      const oldFolder = folders.find((f) => f.id === content.folderId);
      if (oldFolder) {
        const updatedFolder = {
          ...oldFolder,
          contentIds: oldFolder.contentIds.filter((id) => id !== contentId),
        };
        setSessionContent((prev) =>
          prev.map((c) => (c.id === oldFolder.id ? updatedFolder : c)),
        );
        socket.emit("updatedContent", updatedFolder);
      }
    }
  }

  function onMoveContentOutOfFolder(contentId: string, folderId: string): void {
    onMoveContentToFolder(contentId, null);
  }

  const mergedUsers = new Map<string, User & { quantity: number }>();
  for (const user of roomUsers) {
    const userAlreadyIn = mergedUsers.get(user.commonId);
    if (!userAlreadyIn) {
      mergedUsers.set(user.commonId, { ...user, quantity: 1 });
      continue;
    } else userAlreadyIn.quantity++;
  }

  function onClickSetPassword(): void {
    sendPasswordRequest(passwordModalContent);
  }

  function onClickRemovePassword(): void {
    sendPasswordRequest("");
  }

  function onReorderContent(newValues: ContentType[]): void {
    const newOrder = newValues.map((v) => v.id);
    setContentOrder(newOrder);
    onUpdateContentOrder(newOrder, true);
  }

  function sendPasswordRequest(password: string): void {
    setPasswordModalLoading(true);
    api
      .setPassword(password)
      .then(() => {
        setHasPassword(!!password);
      })
      .finally(() => {
        setPasswordModalLoading(false);
        setPasswordModalOpen(false);
      });
  }

  async function handleChangeSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setChangeSessionError("");
    if (!changeSessionValue) {
      setChangeSessionError("Session inexistante");
      return;
    }

    setChangeSessionLoading(true);
    const result = await fetch(
      `/api/sessions?sessionId=${changeSessionValue}&password=${changePasswordValue}&join=true`,
      {},
    )
      .then((res) => res.json())
      .catch(() => undefined);
    setChangeSessionLoading(false);

    if (
      !result ||
      (!result.createNewSession && (!result.sessionId || !result.createdAt))
    ) {
      setChangeSessionError("Session inexistante");
      return;
    }

    if (result.hasPassword && !result.isValidPassword) {
      setChangeSessionError("Mot de passe incorrect");
      return;
    }

    deleteAllCookies();
    const postResult = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        session: changeSessionValue,
        password: changePasswordValue,
        join: "true",
      }),
    }).then((res) => res.json());
    if (postResult?.error) {
      setChangeSessionError("Session inexistante");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="w-full max-w-[1250px] select-none px-4 pb-10">
      <Dialog open={warningModalOpen} onOpenChange={setWarningModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Session expirant bientôt
            </DialogTitle>
            <DialogDescription>
              Cette session temporaire expirera dans moins d&apos;une heure.
              Voulez-vous l&apos;étendre ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Ignorer</Button>
            </DialogClose>
            <Button
              disabled={extendLoading}
              onClick={async () => {
                setExtendLoading(true);
                try {
                  await fetch(`/api/sessions/${session.sessionId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ hours: 1 }),
                  });
                  setWarningModalOpen(false);
                } catch (error) {
                  console.error("Error extending session:", error);
                }
                setExtendLoading(false);
              }}
            >
              {extendLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Étendre de 1 heure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletedModalOpen} onOpenChange={setDeletedModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {"Session supprimée"}
            </DialogTitle>
            <DialogDescription>
              {
                "Cette session temporaire a expiré et a été supprimée. Vous serez redirigé vers la page d'accueil."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                window.location.href = "/";
              }}
            >
              {"Retour à l'accueil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-row items-baseline justify-center gap-[12px] text-xl">
          <button
            className={`cursor-pointer`}
            onClick={() =>
              copyAndToast(
                toast,
                session.sessionId,
                "L'id de la session a été copié",
              )
            }
          >
            #{session.sessionId}
          </button>
        </div>
      </div>
      <div className="h-4" />
      <div className="flex flex-row justify-center gap-2">
        <Dialog open={optionsModalOpen} onOpenChange={setOptionsModalOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              title="Ouvrir les paramètres de la session"
            >
              Paramètres
            </Button>
          </DialogTrigger>
          <DialogContent className="">
            <DialogHeader>
              <DialogTitle>Paramètres de session</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div>
                <h3 className="mb-3 text-lg font-semibold">Informations</h3>
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Nom de session
                    </span>
                    <span className="font-medium">#{session.sessionId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Date de création
                    </span>
                    <span className="font-medium">
                      {new Date(Number(session.createdAt)).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold">Paramètres</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{"Fond d'écran"}</p>
                      <p className="max-w-48 truncate text-sm text-muted-foreground">
                        {session.backgroundImageURL || "Aucun fond d'écran"}
                      </p>
                    </div>
                    <Dialog open={bgModalOpen} onOpenChange={setBgModalOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="min-w-[100px]">
                          Changer
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                          <DialogTitle>{"Mettre un fond d'écran"}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                              {"URL du fond d'écran"}
                            </Label>
                            <Input
                              onChange={(e) =>
                                setBgModalContent(e.target.value)
                              }
                              value={bgModalContent}
                              type="url"
                              placeholder="https://files.copyman.fr/content/bg.jpg"
                              className="col-span-3"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            disabled={bgModalLoading}
                            type="submit"
                            onClick={async () => {
                              setBgModalLoading(true);
                              await fetch("/api/sessions/background", {
                                method: "PATCH",
                                body: JSON.stringify({
                                  background: bgModalContent,
                                }),
                              }).then(() => location.reload());
                              setBgModalLoading(false);
                            }}
                          >
                            {bgModalLoading && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {bgModalContent
                              ? "Sauvegarder"
                              : "Retirer le fond d'écran"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Mot de passe</p>
                      <p className="text-sm text-muted-foreground">
                        {hasPassword
                          ? "Mot de passe activé"
                          : "Aucun mot de passe"}
                      </p>
                    </div>
                    <Dialog
                      open={passwordModalOpen}
                      onOpenChange={(state) => setPasswordModalOpen(state)}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" className="min-w-[100px]">
                          {hasPassword ? "Modifier" : "Définir"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                          <DialogTitle>
                            {hasPassword && "Modifier le mot de passe existant"}
                            {!hasPassword && "Créer un nouveau mot de passe"}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                              Mot de passe
                            </Label>
                            <Input
                              onChange={(e) =>
                                setPasswordModalContent(e.target.value)
                              }
                              value={passwordModalContent}
                              type="password"
                              placeholder="*****"
                              className="col-span-3"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            disabled={!hasPassword}
                            onClick={onClickRemovePassword}
                          >
                            {passwordModalLoading && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Supprimer le mot de passe
                          </Button>
                          <Button
                            disabled={
                              passwordModalLoading || !passwordModalContent
                            }
                            onClick={onClickSetPassword}
                          >
                            {passwordModalLoading && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Sauvegarder le mot de passe
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="h-4" />
                <h3 className="mb-3 text-lg font-semibold text-red-900 dark:text-red-100">
                  Zone de danger
                </h3>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:bg-red-950/20">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between rounded-lg ">
                      <div>
                        <p className="font-medium">Quitter la session</p>
                        <p className="text-sm text-muted-foreground">
                          Quitter la session en cours
                        </p>
                      </div>
                      <Dialog
                        open={leaveConfirmOpen}
                        onOpenChange={setLeaveConfirmOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant={"warning"}
                            className="min-w-[100px]"
                          >
                            Quitter
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirmer</DialogTitle>
                            <DialogDescription>
                              Voulez-vous vraiment quitter la session ?
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Annuler</Button>
                            </DialogClose>
                            <Button
                              variant="warning"
                              onClick={() => {
                                deleteAllCookies();
                                window.location.href = "/";
                              }}
                            >
                              Quitter
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Supprimer la session</p>
                        <p className="text-sm text-muted-foreground">
                          Cette action est irréversible
                        </p>
                      </div>
                      <Dialog
                        open={deleteConfirmOpen}
                        onOpenChange={(open) => {
                          setDeleteConfirmOpen(open);
                          if (!open) setDeleteConfirmValue("");
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="min-w-[100px]"
                          >
                            Supprimer
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Confirmer la suppression</DialogTitle>
                            <DialogDescription>
                              Voulez-vous vraiment supprimer cette session ?{" "}
                              <b>Cette action est irréversible.</b>
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-2">
                            <Label htmlFor="delete-confirm">
                              Tapez <span className="font-bold">SUPPRIMER</span>{" "}
                              pour confirmer
                            </Label>
                            <Input
                              id="delete-confirm"
                              value={deleteConfirmValue}
                              onChange={(e) =>
                                setDeleteConfirmValue(e.target.value)
                              }
                              placeholder="SUPPRIMER"
                            />
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Annuler</Button>
                            </DialogClose>
                            <Button
                              variant="destructive"
                              disabled={deleteConfirmValue !== "SUPPRIMER"}
                              onClick={async () => {
                                await fetch(
                                  `/api/sessions/${session.sessionId}`,
                                  {
                                    method: "DELETE",
                                  },
                                );
                                deleteAllCookies();
                                window.location.href = "/";
                              }}
                            >
                              Supprimer
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={changeSessionOpen} onOpenChange={setChangeSessionOpen}>
          <DialogTrigger asChild>
            <Button variant={"outline"} title="Rejoindre une autre session">
              Changer de session
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Changer de session</DialogTitle>
              <DialogDescription>
                Rejoindre une autre session existante
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChangeSession} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="session">Session</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">#</span>
                  <Input
                    id="session"
                    value={changeSessionValue}
                    onChange={(e) => setChangeSessionValue(e.target.value)}
                    placeholder="session"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">**</span>
                  <Input
                    id="password"
                    type="password"
                    value={changePasswordValue}
                    onChange={(e) => setChangePasswordValue(e.target.value)}
                    placeholder="mot de passe"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="min-h-[20px]">
                {changeSessionError && (
                  <p className="text-sm text-red-500">{changeSessionError}</p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DialogClose>
                <Button type="submit" disabled={changeSessionLoading}>
                  {changeSessionLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Rejoindre
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className="text-sm">
          <span className="text-gray-200">
            {isConnected && (
              <Dialog>
                <DialogTrigger>
                  <div className="flex flex-row items-center justify-end space-x-2">
                    <Button
                      variant={"outline"}
                      title={`Voir les ${roomUsers.length} utilisateurs connectés`}
                    >
                      <div className="flex flex-row items-center justify-center gap-1 font-semibold">
                        <p>{roomUsers.length}</p>{" "}
                        <FontAwesomeIcon icon={faUser} />
                      </div>
                    </Button>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {toPlural(roomUsers.length, "Connecté", "Connectés")} à la
                      session ({roomUsers.length})
                    </DialogTitle>
                    <DialogDescription>
                      <div className="flex flex-col gap-3">
                        {Array.from(mergedUsers.values()).map((u) => {
                          const parser = new UAParser(u.userAgent);
                          const result = parser.getResult();
                          const device = result.device.type || "Desktop";
                          const os = result.os.name || "Inconnu";
                          const browser = result.browser.name || "Inconnu";

                          return (
                            <div
                              key={u.commonId}
                              className="flex flex-row rounded-lg border p-3"
                            >
                              <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faUser} />
                                <span className="w-2 font-medium">
                                  {u.quantity}x
                                </span>
                              </div>
                              <div className="ml-6 mt-1 space-y-1 text-left text-sm">
                                <p>
                                  <span className="text-muted-foreground">
                                    Appareil:
                                  </span>{" "}
                                  {device}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    OS:
                                  </span>{" "}
                                  {os}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Navigateur:
                                  </span>{" "}
                                  {browser}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose>
                      <Button>Cool</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </span>
          {!isConnected && (
            <Dialog>
              <DialogTrigger>
                <div className="">
                  <Button
                    variant={"outline_destructive"}
                    title="Connexion en cours de rechargement"
                  >
                    <div className="flex flex-row items-center justify-center gap-2">
                      <FontAwesomeIcon
                        icon={faWifi}
                        className="animate-slow-blink"
                      />
                    </div>
                  </Button>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Le client est deconnecté du socket.</DialogTitle>
                  <DialogDescription>
                    {`Les changements en direct sont désactivés. Rafraichissez la
                  page pour voir les changements d'autres clients connectés.`}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose>
                    <Button>Bruh</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      <div className="h-8" />
      <div
        className={`relative flex flex-col items-stretch justify-center gap-6 sm:flex-row sm:gap-6 sm:px-6 md:gap-16 md:px-16`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-y-2">
          <div className="flex items-center justify-between">
            <h2>Trucs</h2>
            <button
              onClick={() => setShowTrucs((prev) => !prev)}
              className="text-white/70 transition-colors hover:text-white sm:hidden"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showTrucs ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
          <div
            className={`${showTrucs ? "flex" : "hidden"} flex-col gap-y-2 md:flex`}
          >
            <div
              ref={containerAnimationUploadingRef}
              className="flex items-center gap-2"
            >
              <div className="flex-1">
                <Upload onUploadingFiles={onUploadingFiles} />
                {Array.from(uploadProgressPourcentage.values())
                  .filter((progress) => progress.progress)
                  .map((progress) => (
                    <div className="mt-2">
                      <div className="relative h-6 ">
                        <Progress
                          value={progress.progress}
                          className="h-full"
                        />
                        <span className="tex absolute inset-0 flex items-center justify-center text-sm font-medium text-white mix-blend-difference">
                          {progress.filename} - {progress.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
              <PasteButton
                onPaste={pasteImagesFromClipboard}
                loading={uploadPasteLoading}
              />
              <CreateFolderButton
                targetType="attachment"
                onCreateFolder={(folder) => {
                  onNewContent([folder], true);
                }}
                socketUserId={socketUserId}
                sessionId={session.sessionId}
              />
            </div>
            <div />
            <PhotoProvider>
              <Reorder.Group
                values={[...attachmentFolders, ...attachmentContent]}
                className="flex flex-col gap-y-2 transition-none"
                onReorder={onReorderContent}
              >
                {attachmentFolders.map((folder) => (
                  <Folder
                    key={folder.id}
                    folder={folder}
                    contents={getFolderContents(folder.id)}
                    onFolderUpdate={onUpdateFolder}
                    onFolderDelete={onDeleteFolder}
                    onContentReorder={onReorderFolderContents}
                    onMoveContentOut={onMoveContentOutOfFolder}
                    socketUserId={socketUserId}
                    renderContentItem={(
                      content,
                      folderId,
                      onMoveContentOut,
                    ) => (
                      <ContentRenderer
                        content={content as AttachmentType}
                        onContentDelete={onDeleteContent}
                        onContentUpdate={onUpdateContent}
                        socketUserId={socketUserId}
                        folders={attachmentFolders}
                        onMove={onMoveContentToFolder}
                        folderId={folderId}
                        onMoveContentOut={onMoveContentOut}
                      />
                    )}
                  />
                ))}
                {attachmentContent.map((content) => (
                  <div key={content.id} className="group relative">
                    <ContentRenderer
                      content={content}
                      onContentDelete={onDeleteContent}
                      onContentUpdate={onUpdateContent}
                      socketUserId={socketUserId}
                      folders={attachmentFolders}
                      onMove={onMoveContentToFolder}
                    />
                  </div>
                ))}
              </Reorder.Group>
            </PhotoProvider>
          </div>
        </div>
        <div className={`flex min-w-0 flex-1 flex-col gap-y-2 `}>
          <div className="flex items-center justify-between">
            <h2>Autres trucs</h2>
            <button
              onClick={() => setShowAutresTrucs((prev) => !prev)}
              className="text-white/70 transition-colors hover:text-white sm:hidden"
            >
              <svg
                className={`h-4 w-4 transition-transform ${showAutresTrucs ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
          <div
            className={`${showAutresTrucs ? "flex" : "hidden"} flex-col gap-y-2 md:flex`}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <AddNewTask
                  onNewContent={(n) => onNewContent([n])}
                  socketUserId={socketUserId}
                  ref={newTaskComponent}
                />
              </div>
              <PasteButton
                onPaste={(text) => newTaskComponent.current?.addTask(text)}
              />
              <CreateFolderButton
                targetType="note"
                onCreateFolder={(folder) => {
                  onNewContent([folder], true);
                }}
                socketUserId={socketUserId}
                sessionId={session.sessionId}
              />
            </div>
            <div />
            <Reorder.Group
              values={[...noteFolders, ...noteContent]}
              className="flex flex-col gap-y-2 transition-none"
              onReorder={onReorderContent}
            >
              {noteFolders.map((folder) => (
                <Folder
                  key={folder.id}
                  folder={folder}
                  contents={getFolderContents(folder.id)}
                  onFolderUpdate={onUpdateFolder}
                  onFolderDelete={onDeleteFolder}
                  onContentReorder={onReorderFolderContents}
                  onMoveContentOut={onMoveContentOutOfFolder}
                  socketUserId={socketUserId}
                  renderContentItem={(content, folderId, onMoveContentOut) => (
                    <Note
                      session={session}
                      allContent={sessionContent}
                      content={content as NoteType}
                      socketUserId={socketUserId}
                      onDeleteTask={onDeleteContent}
                      onUpdateTask={onUpdateContent}
                      folders={noteFolders}
                      onMove={onMoveContentToFolder}
                      folderId={folderId}
                      onMoveContentOut={onMoveContentOut}
                    />
                  )}
                />
              ))}
              {noteContent.map((note) => (
                <div key={note.id} className="group relative">
                  <Note
                    session={session}
                    allContent={sessionContent}
                    content={note}
                    socketUserId={socketUserId}
                    onDeleteTask={onDeleteContent}
                    onUpdateTask={onUpdateContent}
                    folders={noteFolders}
                    onMove={onMoveContentToFolder}
                  />
                </div>
              ))}
            </Reorder.Group>
          </div>
        </div>
      </div>
    </div>
  );
}
