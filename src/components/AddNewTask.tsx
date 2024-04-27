"use client";

import { ContentType, NoteType } from "~/server/db/redis";

export function AddNewTask({
  onNewContent = () => {},
}: {
  onNewContent?: (task: NoteType) => any;
}) {
  const addTask = (content: string) => {
    fetch("/api/notes", {
      method: "POST",
      body: JSON.stringify({ content: content } as NoteType),
    }).then((res) => {
      if (res.ok) {
        res.json().then((task) => {
          onNewContent(task);
        });
      }
    });
  };

  return (
    <div className="flex h-16 flex-col gap-2 rounded-xl bg-white px-2 py-2 text-black">
      <textarea
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
