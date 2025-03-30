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
import { AddNewTask, AddNewTaskRef } from "~/components/AddNewTask";
import ContentRenderer from "~/components/ContentRenderer";
import { Task } from "~/components/Task";
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
import { deleteAllCookies, sortAttachments } from "~/lib/utils";
import {
  AttachmentType,
  ContentOrder,
  ContentType,
  NoteType,
  SessionType,
} from "~/server/db/redis";
import { Reorder } from "framer-motion";
import { useToast } from "~/hooks/use-toast";
import { DialogClose } from "@radix-ui/react-dialog";
import { User } from "~/server";
import Upload from "~/components/Upload";
import { uploadFiles } from "~/lib/client/uploadFile";

export function ActiveSession({
  session,
  sessionContents,
  hasPassword: _hasPassword,
  sessionContentOrder,
}: {
  session: SessionType;
  sessionContents: ContentType[];
  hasPassword: boolean;
  sessionContentOrder: ContentOrder;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [roomUsers, setRoomUsers] = useState<User[]>([]);
  const [transport, setTransport] = useState("N/A");
  const { toast } = useToast();

  const [hasPassword, setHasPassword] = useState(_hasPassword);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalContent, setPasswordModalContent] = useState("");
  const [bgModalContent, setBgModalContent] = useState(
    session.backgroundImageURL ?? "",
  );
  const [bgModalLoading, setBgModalLoading] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [contentOrder, setContentOrder] =
    useState<ContentOrder>(sessionContentOrder);
  const [cachedContents, setCachedContents] =
    useState<ContentType[]>(sessionContents);

  const newTaskComponent = useRef<AddNewTaskRef>(null);

  function onConnect() {
    setIsConnected(true);
  }

  function onDisconnect() {
    setIsConnected(false);
    setTransport("N/A");
  }

  const onNewContent = (content: ContentType[], emit = true) => {
    if (emit) socket.emit("addContent", content);
    setCachedContents((prev) => [...prev, ...content]);
  };

  const onContentDelete = (contentId: string, emit = true) => {
    if (emit) socket.emit("deleteContent", contentId);
    setCachedContents((prev) => prev.filter((c) => c.id !== contentId));
  };

  function onContentOrderUpdate(order: ContentOrder, emit = true) {
    if (emit) socket.emit("updatedContentOrder", order);
    setContentOrder(order);
  }

  function onRoomInsight(room: { users: User[] }) {
    setRoomUsers(room.users);
  }

  function onContentUpdate(content: ContentType, emit = true) {
    if (emit) socket.emit("updatedContent", content);
    else {
      const index = cachedContents.findIndex((c) => c.id == content.id);
      if (!index && !cachedContents[index]) throw "Client unsynced with server";
      setCachedContents((prev) =>
        prev.map((c) => {
          if (c.id == content.id) {
            return content;
          }
          return c;
        }),
      );
    }
  }

  useEffect(() => {
    setIsConnected(socket.connected);
    if (socket.connected) {
      onConnect();
    }

    socket.on("updatedContent", (content) => onContentUpdate(content, false));

    socket.on("addContent", (content) => {
      onNewContent(content, false);
    });

    socket.on("deleteContent", (contentId) => {
      onContentDelete(contentId, false);
    });

    socket.on("updatedContentOrder", (order) => {
      onContentOrderUpdate(order, false);
    });

    socket.on("roomInsight", (room) => {
      onRoomInsight(room);
    });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("updatedContent");
      socket.off("addContent");
      socket.off("deleteContent");
      socket.off("updatedContentOrder");
      socket.off("roomInsight");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  const handleGlobalPaste = (event: ClipboardEvent) => {
    const activeElement = document.activeElement as HTMLElement;

    if (
      activeElement.tagName !== "TEXTAREA" &&
      activeElement.tagName !== "INPUT"
    ) {
      const clipboardData = event.clipboardData;
      if (clipboardData) {
        handleClipboardData(clipboardData);
      }
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files) {
      const attachments = await uploadFiles(Array.from(files));
      if (!attachments) return;
      onNewContent(attachments);
    }
  };

  const handleClipboardData = async (clipboardData: DataTransfer) => {
    const text = clipboardData.getData("text");
    if (text) {
      newTaskComponent.current?.addTask(text);
    }

    const attachments: AttachmentType[] = [];
    for (const item of clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        const newAttachments = await uploadFiles([file]);
        if (!newAttachments) continue;
        attachments.push(...newAttachments);
      }
    }
    if (!attachments) return;
    onNewContent(attachments);
  };

  useEffect(() => {
    document.addEventListener("paste", handleGlobalPaste);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("paste", handleGlobalPaste);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

  const attachmentContent: AttachmentType[] = cachedContents
    .filter((c: ContentType): c is AttachmentType => c.type === "attachment")
    .sort((a, b) => sortAttachments(a, b, contentOrder));

  const noteContent: NoteType[] = cachedContents
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

  return (
    <div className="w-full max-w-[1250px] select-none px-4 pb-10">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-row items-center gap-[12px] text-xl">
          <button
            className={`cursor-pointer`}
            onClick={() => setHidden(!hidden)}
          >
            #
            {hidden
              ? new Array(session.sessionId.length).fill("*").join("")
              : session.sessionId}
          </button>
          <div />
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
                    id="password"
                    type="password"
                    placeholder="passman"
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={passwordModalLoading}
                  type="submit"
                  onClick={async () => {
                    setPasswordModalLoading(true);
                    await fetch("/api/sessions/", {
                      method: "PATCH",
                      body: JSON.stringify({
                        password: passwordModalContent,
                      }),
                    }).then(() => setHasPassword(!!passwordModalContent));
                    setPasswordModalLoading(false);
                    setPasswordModalOpen(false);
                  }}
                >
                  {passwordModalLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {passwordModalContent
                    ? "Sauvegarder"
                    : "Retirer le mot de passe"}
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
          Créée le {new Date(parseInt(session.createdAt)).toLocaleDateString()}{" "}
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
        className={`} relative flex flex-col items-stretch justify-center gap-0 sm:flex-row sm:gap-16 sm:px-16`}
      >
        <div className="flex flex-col gap-y-2 sm:w-1/2">
          <h2>Trucs</h2>
          <div className="h-16">
            <Upload onNewContent={onNewContent} />
          </div>
          <div />
          <Reorder.Group
            values={attachmentContent}
            className="flex flex-col gap-y-2"
            onReorder={(newValues) => {
              const newOrder = newValues.map((v) => v.id);
              setContentOrder(newOrder);
              onContentOrderUpdate([...newOrder, ...contentOrder], true);
            }}
          >
            {attachmentContent.map((content, index) => (
              <ContentRenderer
                key={content.id}
                content={content}
                onContentDelete={onContentDelete}
              />
            ))}
          </Reorder.Group>
        </div>
        <div className={`flex flex-col gap-y-2 sm:w-1/2`}>
          <h2>Autres trucs</h2>
          <AddNewTask
            onNewContent={(n) => onNewContent([n])}
            ref={newTaskComponent}
          />
          <div />
          <Reorder.Group
            values={noteContent}
            className="flex flex-col gap-y-2"
            onReorder={(newValues) => {
              const newOrder = newValues.map((v) => v.id);
              setContentOrder(newOrder);
              onContentOrderUpdate([...newOrder, ...contentOrder], true);
            }}
          >
            {noteContent.map((task, index) => (
              <Task
                key={task.id}
                allContent={cachedContents}
                content={task}
                onDeleteTask={onContentDelete}
                onUpdateTask={onContentUpdate}
              />
            ))}
          </Reorder.Group>
        </div>
      </div>
    </div>
  );
}
