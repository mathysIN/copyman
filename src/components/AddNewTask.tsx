"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { NoteType } from "~/server/db/redis";

interface Props {}

export type AddNewTaskRef = {
  addTask: (content: string) => Promise<any>;
};

const _AddNewTask = forwardRef(
  (
    { onNewContent = () => {} }: { onNewContent?: (task: NoteType) => any },
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
      await fetch("/api/notes", {
        method: "POST",
        body: JSON.stringify({ content: content } as NoteType),
      }).then((res) => {
        if (res.ok) {
          res.json().then((task) => {
            onNewContent(task);
          });
        }
      });
      setLoading(false);
    };

    return (
      <div
        className={`${loading && "animate-pulse cursor-wait opacity-75"} flex h-16 flex-col gap-2 rounded-xl bg-white px-2 py-2 text-black`}
      >
        <textarea
          ref={textareaRef}
          disabled={loading}
          placeholder="Nouvelle note"
          className="h-full"
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const target = e.currentTarget;
              const content = target.value;
              if (!content) return;
              await addTask(content);
              setTimeout(() => (target.value = ""), 0);
            }
          }}
        />
      </div>
    );
  },
);

_AddNewTask.displayName = "AddNewTask";

export const AddNewTask = _AddNewTask;
