"use client";

import { faDoorOpen, faLock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AddNewTask } from "~/components/AddNewTask";
import ContentRenderer from "~/components/ContentRenderer";
import { Task } from "~/components/Task";
import UploadContent from "~/components/UploadContent";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { socket } from "~/lib/client/socket";
import { ConnectionStart } from "~/server";
import {
  AttachmentType,
  ContentType,
  NoteType,
  SessionType,
} from "~/server/db/redis";

export function ActiveSession({
  session,
  sessionContents,
  hasPassword: _hasPassword,
}: {
  session: SessionType;
  sessionContents: ContentType[];
  hasPassword: boolean;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");

  useEffect(() => {
    setIsConnected(socket.connected);
    console.log({ connected: socket.connected });
    if (socket.connected) {
      onConnect();
    }
    socket.emit("connection_start");

    function onConnect() {
      socket.emit("connection_start");

      socket.emit("message", "bruh");
      socket.emit("message", "bruh");
    }

    function onDisconnect() {
      setIsConnected(false);
      setTransport("N/A");
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  const [hasPassword, setHasPassword] = useState(_hasPassword);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalLoading, setPasswordModalLoading] = useState(false);
  const [passwordModalContent, setPasswordModalContent] = useState("");
  const [hidden, setHidden] = useState(true);
  const [cachedContents, setCachedContents] =
    useState<ContentType[]>(sessionContents);
  return (
    <div className="w-4/5 pb-10">
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
                className={`${hasPassword && "text-yellow-400"}`}
              />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
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
                  Sauvegarder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <button
            onClick={() => {
              document.cookie = `session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
              document.cookie = `password=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
              window.location.href = "/";
            }}
          >
            <FontAwesomeIcon icon={faDoorOpen} />
          </button>
        </div>
        <span>{isConnected ? "connected" : "no conntected"}</span>
        <button
          onClick={() => {
            alert("bruh");
            socket.emit("my_event", { a: 1 });
            socket.emit("message", "bruh");
          }}
        >
          fuck
        </button>
        <span className="text-gray-200">
          Créé le {new Date(parseInt(session.createdAt)).toLocaleDateString()}
        </span>
      </div>
      <div className="h-8" />
      <div className="flex flex-col items-stretch  justify-center gap-16 sm:flex-row sm:px-16">
        <div className="flex grow basis-0 flex-col gap-y-2">
          <h2>Trucs</h2>{" "}
          <UploadContent
            onNewContent={(content) =>
              setCachedContents([content, ...cachedContents])
            }
          />
          {cachedContents
            .filter(
              (c: ContentType): c is AttachmentType => c.type == "attachment",
            )
            .map((content) => (
              <ContentRenderer
                key={content.id}
                content={content}
                onContentDelete={() =>
                  setCachedContents(
                    cachedContents.filter((c) => c.id !== content.id),
                  )
                }
              />
            ))}
        </div>
        <div className="flex grow basis-0 flex-col gap-y-2">
          <h2>Autres trucs</h2>
          <AddNewTask
            onNewContent={(content) =>
              setCachedContents([content, ...cachedContents])
            }
          />
          {cachedContents
            .filter((c: ContentType): c is NoteType => c.type == "note")
            .map((task) => (
              <Task
                key={task.id}
                content={task}
                onDeleteTask={() => {
                  setCachedContents(
                    cachedContents.filter((c) => c.id !== task.id),
                  );
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
