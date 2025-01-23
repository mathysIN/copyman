"use client";

import {
  faDoorOpen,
  faLock,
  faWarning,
  faDownload,
  faCopy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddNewTask, AddNewTaskRef } from "~/components/AddNewTask";
import ContentRenderer from "~/components/ContentRenderer";
import { Task } from "~/components/Task";
import UploadContent, {
  UPLOADTHING_ENDPOINT,
} from "~/components/UploadContent";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { socket } from "~/lib/client/socket";
import { deleteAllCookies } from "~/lib/utils";
import {
  AttachmentType,
  ContentOrder,
  ContentType,
  NoteType,
  SessionType,
} from "~/server/db/redis";
import { useUploadThing } from "~/utils/uploadthing";
import { DragControls, Reorder, useDragControls } from "framer-motion";
import { useToast } from "~/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { DialogClose } from "@radix-ui/react-dialog";

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
  const uploadThing = useUploadThing(UPLOADTHING_ENDPOINT, {
    onClientUploadComplete: (res) => {
      const response = res[0];
      if (!response) return;
      const content: AttachmentType = response.serverData;
      onNewContent(content);
    },
    onUploadError: (error) => {
      toast({
        description: `Une erreur a eu lieu lors de la mise en ligne du fichier`,
        variant: "destructive",
      });
    },
  });

  const [isConnected, setIsConnected] = useState(false);
  const [roomSize, setRoomSize] = useState(0);
  const [transport, setTransport] = useState("N/A");
  const { toast } = useToast();

  const [hasPassword, setHasPassword] = useState(_hasPassword);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalContent, setPasswordModalContent] = useState("");
  const [hidden, setHidden] = useState(true);
  const [orderNote, setOrderNote] = useState<ContentOrder>(sessionContentOrder);
  const [orderAttachment, setOrderAttachment] =
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

  function onNewContent(content: ContentType, emit = true) {
    if (emit) socket.emit("addContent", content);
    setCachedContents([content, ...cachedContents]);
  }

  function onContentDelete(contentId: string, emit = true) {
    if (emit) socket.emit("deleteContent", contentId);
    setCachedContents(cachedContents.filter((c) => c.id !== contentId));
  }

  function onContentOrderUpdate(order: ContentOrder, emit = true) {
    if (emit) socket.emit("updatedContentOrder", order);
    setOrderNote(order);
    setOrderAttachment(order);
  }

  function onContentUpdate(content: ContentType, emit = true) {
    if (emit) socket.emit("updatedContent", content);
    else {
      const index = cachedContents.findIndex((c) => c.id == content.id);
      if (!index && !cachedContents[index]) throw "Client unsynced with server";
      setCachedContents(
        cachedContents.map((c) => {
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
      setRoomSize(room.connectedCount);
    });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
  }, [onNewContent]);

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

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) uploadFile(file);
  };

  const handleClipboardData = (clipboardData: DataTransfer) => {
    const text = clipboardData.getData("text");
    if (text) {
      newTaskComponent.current?.addTask(text);
    }

    for (const item of clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        uploadFile(file);
      }
    }
  };

  const uploadFile = (file: File) => {
    uploadThing.startUpload([file]).catch((error) => {
      toast({
        description: `Une erreur a eu lieu lors de la mise en ligne du fichier`,
        variant: "destructive",
      });
    });
    toast({
      description: `Mise en ligne de ${file.name}`,
    });
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
    .sort((a, b) => {
      return orderAttachment.indexOf(a.id) - orderAttachment.indexOf(b.id);
    });

  const noteContent: NoteType[] = cachedContents
    .filter((c: ContentType): c is NoteType => c.type === "note")
    .sort((a, b) => {
      return orderNote.indexOf(a.id) - orderNote.indexOf(b.id);
    });

  return (
    <div className="w-4/5 select-none pb-10">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-row items-center gap-[12px] text-xl">
          <h1 className={`cursor-pointer`} onClick={() => setHidden(!hidden)}>
            #
            {hidden
              ? new Array(session.sessionId.length).fill("*").join("")
              : session.sessionId}
          </h1>
          <div />
          <Dialog
            open={passwordModalOpen}
            onOpenChange={(state) => setPasswordModalOpen(state)}
          >
            <DialogTrigger asChild className="cursor-pointer">
              <FontAwesomeIcon
                icon={faLock}
                className={`${hasPassword && "text-yellow-400"} active:scale-95`}
              />
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
          Créée le {new Date(parseInt(session.createdAt)).toLocaleDateString()}
          {isConnected && <> - {roomSize} connectés</>}
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
            <UploadContent
              className="h-16 hover:opacity-90"
              onNewContent={onNewContent}
            />
          </div>
          <div />
          <Reorder.Group
            values={attachmentContent}
            className="flex flex-col gap-y-2"
            onReorder={(newValues) => {
              const newOrder = newValues.map((v) => v.id);
              setOrderAttachment(newOrder);
              onContentOrderUpdate([...newOrder, ...orderNote], true);
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
          <AddNewTask onNewContent={onNewContent} ref={newTaskComponent} />
          <div />
          <Reorder.Group
            values={noteContent}
            className="flex flex-col gap-y-2"
            onReorder={(newValues) => {
              const newOrder = newValues.map((v) => v.id);
              setOrderNote(newOrder);
              onContentOrderUpdate([...newOrder, ...orderAttachment], true);
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
