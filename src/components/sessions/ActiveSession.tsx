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
import { TimeValues, deleteAllCookies, sortAttachments } from "~/lib/utils";
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
  const [bgModalContent, setBgModalContent] = useState(
    session.backgroundImageURL ?? "",
  );
  const [bgModalLoading, setBgModalLoading] = useState(false);
  const [contentOrder, setContentOrder] =
    useState<ContentOrder>(sessionContentOrder);
  const [sessionContent, setSessionContent] =
    useState<ContentType[]>(baseSessionContent);

  const [show, setShow] = useState(false);
  const containerAnimationUploadingRef = useRef(null);

  useEffect(() => {
    containerAnimationUploadingRef.current &&
      autoAnimate(containerAnimationUploadingRef.current);
  }, [containerAnimationUploadingRef]);

  const newTaskComponent = useRef<AddNewTaskRef>(null);

  function onConnect(): void {
    setIsConnected(true);
  }

  function onDisconnect(): void {
    setIsConnected(false);
  }

  function onNewContent(content: ContentType[], emit = true): void {
    if (emit) socket.emit("addContent", content);
    const next = [...sessionContent, ...content];
    setSessionContent(next);
    void saveOfflineSession({
      sessionId: session.sessionId,
      content: next,
      order: contentOrder,
      updatedAt: Date.now(),
    });
  }

  function onDeleteContent(contentId: string, emit = true): void {
    if (emit) socket.emit("deleteContent", contentId);
    const next = sessionContent.filter((c) => c.id !== contentId);
    setSessionContent(next);
    void saveOfflineSession({
      sessionId: session.sessionId,
      content: next,
      order: contentOrder,
      updatedAt: Date.now(),
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
      const next = sessionContent.map((c) =>
        c.id == content.id ? content : c,
      );
      setSessionContent(next);
      void saveOfflineSession({
        sessionId: session.sessionId,
        content: next,
        order: contentOrder,
        updatedAt: Date.now(),
      });
    }
  }

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    // If offline at mount, hydrate from local store
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

    const uploadedFiles = await realUploadFile(files, (progress: number) => {
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
    });

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
                  className={`${hasPassword && "text-yellow-400"} active:scale-95`}
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
                <FontAwesomeIcon icon={faImage} className={`active:scale-95`} />
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
            className="active:scale-95"
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
                <div className="flex flex-row items-center justify-center space-x-2">
                  <button> - {roomUsers.length} connectés</button>
                </div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Connectés à la session ({roomUsers.length})
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
              <div className="flex flex-row items-center justify-center space-x-2">
                <FontAwesomeIcon icon={faWarning} />
                <span className="text-red-400">
                  Le client est deconnecté du socket.
                </span>
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
        <div className="flex min-w-0 flex-1 flex-col gap-y-2 ">
          <h2>Trucs</h2>
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
          <Reorder.Group
            values={attachmentContent}
            className="flex flex-col gap-y-2"
            onReorder={onReorderContent}
          >
            {attachmentContent.map((content) => (
              <ContentRenderer
                key={content.id}
                content={content}
                onContentDelete={onDeleteContent}
              />
            ))}
          </Reorder.Group>
        </div>
        <div className={`flex min-w-0 flex-1 flex-col gap-y-2 `}>
          <h2>Autres trucs</h2>
          <AddNewTask
            onNewContent={(n) => onNewContent([n])}
            ref={newTaskComponent}
          />
          <div />
          <Reorder.Group
            values={noteContent}
            className="flex flex-col gap-y-2"
            onReorder={onReorderContent}
          >
            {noteContent.map((note) => (
              <Note
                session={session}
                key={note.id}
                allContent={sessionContent}
                content={note}
                onDeleteTask={onDeleteContent}
                onUpdateTask={onUpdateContent}
              />
            ))}
          </Reorder.Group>
        </div>
      </div>
    </div>
  );
}
