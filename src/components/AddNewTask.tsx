"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { type NoteType } from "~/server/db/redis";
import { toast } from "~/hooks/use-toast";

export type EncryptNoteFunction = (content: string) => Promise<{
  content: string;
  isEncrypted: boolean;
  encryptedIv: string;
  encryptedSalt: string;
}>;

export type AddNewTaskRef = {
  addTask: (content: string) => Promise<any>;
};

const _AddNewTask = forwardRef(
  (
    {
      onNewContent = () => {},
      socketUserId,
      encryptNote,
      isEncryptionEnabled,
    }: {
      onNewContent?: (task: NoteType) => any;
      socketUserId?: string;
      encryptNote?: EncryptNoteFunction;
      isEncryptionEnabled?: boolean;
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [loading, setLoading] = useState(false);

    useImperativeHandle(
      ref,
      () =>
        ({
          addTask,
        }) satisfies AddNewTaskRef,
    );

    const addTask = async (content: string) => {
      if (loading) return;
      if (textareaRef?.current) textareaRef.current.value = content;
      setLoading(true);
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 8000);

      let noteData: {
        content: string;
        isEncrypted?: boolean;
        encryptedIv?: string;
        encryptedSalt?: string;
      } = { content };

      if (isEncryptionEnabled && encryptNote) {
        console.log("[E2EE] AddNewTask: encrypting note content");
        try {
          noteData = await encryptNote(content);
          console.log(
            "[E2EE] AddNewTask: content encrypted, ciphertext length:",
            noteData.content.length,
          );
        } catch (e) {
          console.error("[E2EE] AddNewTask: failed to encrypt:", e);
          toast({
            description: "Erreur lors du chiffrement",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      await fetch("/api/notes", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "X-Socket-User-Id": socketUserId ?? "",
        },
        body: JSON.stringify(noteData),
      })
        .then((res) => {
          if (res.ok) {
            res.json().then((task) => {
              onNewContent(task);
              setTimeout(() => {
                if (textareaRef.current == null)
                  throw new Error("Cannot find new note textarea reference");
                textareaRef.current.value = "";
              }, 0);
            });
          }
        })
        .catch((error) => {
          console.error("Task creation error:", error);
          toast({
            description: `Une erreur a eu lieu lors de la création de la note`,
            variant: "destructive",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    };

    return (
      <div
        className={`${loading && "animate-pulse cursor-wait opacity-75"} flex h-16 items-center rounded-xl bg-white px-2 py-2 text-black`}
      >
        <textarea
          ref={textareaRef}
          disabled={loading}
          placeholder="Nouvelle note"
          className="h-full w-full resize-none"
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const target = e.currentTarget;
              const content = target.value;
              if (!content) return;
              await addTask(content);
            }
          }}
        />
      </div>
    );
  },
);

_AddNewTask.displayName = "AddNewTask";

export const AddNewTask = _AddNewTask;
