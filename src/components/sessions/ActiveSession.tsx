"use client";

import {
  faDoorOpen,
  faImage,
  faLock,
  faWarning,
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
import { deleteAllCookies, sortAttachments, toPlural } from "~/lib/utils";
import {
  type AttachmentType,
  type ContentOrder,
  type ContentType,
  type NoteType,
  type SessionType,
} from "~/server/db/redis";
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

  const [hasPassword, setHasPassword] = useState(baseHasPassword);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalContent, setPasswordModalContent] = useState("");
  const [socketUserId, setSocketUserId] = useState<string | undefined>(
    undefined,
  );
  const [bgModalContent, setBgModalContent] = useState(
    session.backgroundImageURL ?? "",
  );
  const [bgModalLoading, setBgModalLoading] = useState(false);
  const [contentOrder, setContentOrder] =
    useState<ContentOrder>(sessionContentOrder);
  const [sessionContent, setSessionContent] =
    useState<ContentType[]>(baseSessionContent);

  const [showTrucs, setShowTrucs] = useState(true);
  const [showAutresTrucs, setShowAutresTrucs] = useState(true);
  const containerAnimationUploadingRef = useRef(null);

  useEffect(() => {
    containerAnimationUploadingRef.current &&
      autoAnimate(containerAnimationUploadingRef.current);
  }, [containerAnimationUploadingRef]);

  const newTaskComponent = useRef<AddNewTaskRef>(null);

  const lastHelloSocketIdRef = useRef<string | null>(null);

  function onConnect(): void {
    setIsConnected(true);
    // Avoid emitting "hello" twice for the same socket.id (e.g., mount + connect event)
    if (lastHelloSocketIdRef.current === socket.id) return;
    lastHelloSocketIdRef.current = socket.id ?? null;
    socket.emit("hello");
  }

  function onWelcome(socketUserId: string): void {
    setSocketUserId(socketUserId);
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
    if (emit) socket.emit("updatedContentOrder", order);
    setContentOrder(order);
    void saveOfflineSession({
      sessionId: session.sessionId,
      content: sessionContent,
      order,
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

  async function uploadFiles(files: File[]): Promise<AttachmentType[] | null> {
    const uploadId = crypto.randomUUID();

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

  const attachmentContent: AttachmentType[] = sessionContent
    .filter((c: ContentType): c is AttachmentType => c.type === "attachment")
    .sort((a, b) => sortAttachments(a, b, contentOrder));

  const noteContent: NoteType[] = sessionContent
    .filter((c: ContentType): c is NoteType => c.type === "note")
    .sort((a, b) => sortAttachments(a, b, contentOrder));

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
    onUpdateContentOrder([...newOrder, ...contentOrder], true);
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

  return (
    <div className="w-full max-w-[1250px] select-none px-4 pb-10">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-row items-center gap-[12px] text-xl">
          <button className={`cursor-pointer`}>#{session.sessionId}</button>
          {false && (
            <span className="rounded bg-red-500/20 px-2 py-0.5 text-sm text-red-300">
              Offline
            </span>
          )}
          <Dialog
            open={passwordModalOpen}
            onOpenChange={(state) => setPasswordModalOpen(state)}
          >
            <DialogTrigger asChild>
              <button>
                <FontAwesomeIcon
                  icon={faLock}
                  className={`${hasPassword && "text-yellow-400"} active:scale-90 active:opacity-75`}
                />
              </button>
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
                    onChange={(e) => setPasswordModalContent(e.target.value)}
                    value={passwordModalContent}
                    type="password"
                    placeholder="*****"
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={hasPassword} onClick={onClickRemovePassword}>
                  {passwordModalLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Supprimer le mot de passe
                </Button>
                <Button
                  disabled={passwordModalLoading || !passwordModalContent}
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
          <Dialog>
            <DialogTrigger asChild>
              <button>
                <FontAwesomeIcon
                  icon={faImage}
                  className={`active:scale-90 active:opacity-75`}
                />
              </button>
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
                    onChange={(e) => setBgModalContent(e.target.value)}
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
                  {bgModalContent ? "Sauvegarder" : "Retirer le fond d'écran"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <button
            className="active:scale-90 active:opacity-75"
            onClick={() => {
              deleteAllCookies();
              window.location.href = "/";
            }}
          >
            <FontAwesomeIcon icon={faDoorOpen} />
          </button>
        </div>
        <span className="text-gray-200">
          {isConnected && (
            <Dialog>
              <DialogTrigger>
                <div className="my-1 flex flex-row items-center justify-center space-x-2">
                  <button className="rounded-xl bg-white px-4 text-black">
                    {roomUsers.length}{" "}
                    {toPlural(roomUsers.length, "connecté", "connectés")}
                  </button>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {toPlural(roomUsers.length, "Connecté", "Connectés")} à la
                    session ({roomUsers.length})
                  </DialogTitle>
                  <DialogDescription>
                    <div className="flex flex-col gap-2">
                      <p>Users agents des utilisateurs connectés :</p>
                      {Array.from(mergedUsers.values()).map((u) => (
                        <p>
                          - {u.quantity > 1 && `(x${u.quantity}) `}
                          {u.userAgent}
                        </p>
                      ))}
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
              <div className="my-1 space-x-1 rounded-xl bg-red-400 px-4 text-white">
                <FontAwesomeIcon icon={faWarning} />
                <span>Le client est deconnecté du socket.</span>
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
            <div ref={containerAnimationUploadingRef}>
              <Upload className="h-16" onUploadingFiles={onUploadingFiles} />
              {Array.from(uploadProgressPourcentage.values())
                .filter((progress) => progress.progress)
                .map((progress) => (
                  <div className="mt-2">
                    <div className="relative h-6 ">
                      <Progress value={progress.progress} className="h-full" />
                      <span className="tex absolute inset-0 flex items-center justify-center text-sm font-medium text-white mix-blend-difference">
                        {progress.filename} - {progress.progress}%
                      </span>
                    </div>
                  </div>
                ))}
            </div>
            <div />
            <PhotoProvider>
              <Reorder.Group
                values={attachmentContent}
                className="flex flex-col gap-y-2 transition-none"
                onReorder={onReorderContent}
              >
                {attachmentContent.map((content) => (
                  <ContentRenderer
                    key={content.id}
                    content={content}
                    onContentDelete={onDeleteContent}
                    onContentUpdate={onUpdateContent}
                  />
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
            <AddNewTask
              onNewContent={(n) => onNewContent([n])}
              socketUserId={socketUserId}
              ref={newTaskComponent}
            />
            <div />
            <Reorder.Group
              values={noteContent}
              className="flex flex-col gap-y-2 transition-none"
              onReorder={onReorderContent}
            >
              {noteContent.map((note) => (
                <Note
                  session={session}
                  key={note.id}
                  allContent={sessionContent}
                  content={note}
                  socketUserId={socketUserId}
                  onDeleteTask={onDeleteContent}
                  onUpdateTask={onUpdateContent}
                />
              ))}
            </Reorder.Group>
          </div>
        </div>
      </div>
    </div>
  );
}
