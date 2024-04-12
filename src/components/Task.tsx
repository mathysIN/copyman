"use client";

import { useEffect, useState } from "react";
import { tasksType } from "~/server/db/schema";

const REQUEST_DELAY = 800;

export function Task({ task }: { task: tasksType }) {
  const [value, setValue] = useState(task.name ?? "");
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (timerId) {
      clearTimeout(timerId);
    }
    const newTimerId = setTimeout(() => editTask(newValue), REQUEST_DELAY);
    setTimerId(newTimerId);
  };

  const editTask = (newValue: string) => {
    fetch("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ name: newValue, taskId: task.id }),
    }).then(() => {
      setTimerId(null);
    });
  };

  return (
    <div
      key={task.id}
      className="flex flex-col gap-2 rounded-xl bg-white px-2 py-2 text-black"
    >
      <input value={value} onChange={handleChange} />
    </div>
  );
}
