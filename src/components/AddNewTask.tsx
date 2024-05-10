"use client";

import { useState } from "react";
import { ContentType, NoteType } from "~/server/db/redis";

export function AddNewTask({
  onNewContent = () => {},
}: {
  onNewContent?: (task: NoteType) => any;
}) {
  const [loading, setLoading] = useState(false);

  const addTask = async (content: string) => {
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
        disabled={loading}
        placeholder="Nouvelle note"
        className="h-full"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const target = e.currentTarget;
            const content = target.value;
            if (!content) return;
            addTask(content);
            setTimeout(() => (target.value = ""), 0);
          }
        }}
      />
    </div>
  );
}
