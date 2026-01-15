"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaste } from "@fortawesome/free-solid-svg-icons";
import { NoteType } from "~/server/db/redis";
import { toast } from "~/hooks/use-toast";

export type AddNewTaskRef = {
  addTask: (content: string) => Promise<any>;
};

const _AddNewTask = forwardRef(
  (
    {
      onNewContent = () => {},
      socketUserId,
    }: {
      onNewContent?: (task: NoteType) => any;
      socketUserId?: string;
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
      await fetch("/api/notes", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "X-Socket-User-Id": socketUserId ?? "",
        },
        body: JSON.stringify({ content: content } as NoteType),
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
        className={`${loading && "animate-pulse cursor-wait opacity-75"} flex h-16 items-center gap-2 rounded-xl bg-white px-2 py-2 text-black`}
      >
        <textarea
          ref={textareaRef}
          disabled={loading}
          placeholder="Nouvelle note (CTRL+V pour coller instantanément)"
          className="h-full flex-1"
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const target = e.currentTarget;
              const content = target.value;
              if (!content) return;
              await addTask(content);
            }
          }}
        />
        <button
          disabled={loading}
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text) {
                await addTask(text);
              }
            } catch (err) {
              console.error("Failed to read clipboard:", err);
            }
          }}
          className="h-full rounded-lg bg-neutral-100 px-3 text-sm active:scale-90 active:opacity-75 disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faPaste} />
        </button>
      </div>
    );
  },
);

_AddNewTask.displayName = "AddNewTask";

export const AddNewTask = _AddNewTask;
