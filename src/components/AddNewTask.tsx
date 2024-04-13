"use client";

import type { tasksType } from "~/server/db/schema";

export function AddNewTask({
  onNewTask = () => {},
}: {
  onNewTask?: (task: tasksType) => any;
}) {
  const addTask = (name: string) => {
    fetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((res) => {
      if (res.ok) {
        res.json().then((task) => {
          onNewTask(task);
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
            addTask(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}
