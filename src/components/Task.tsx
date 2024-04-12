"use client";

import { useEffect, useState } from "react";
import { tasksType } from "~/server/db/schema";

const REQUEST_DELAY = 800;

export function Task({
  task,
  onDeleteTask = () => {},
}: {
  task: tasksType;
  onDeleteTask: (taskId: number) => any;
}) {
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
      method: "PATCH",
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 cursor-pointer text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        onClick={() => {
          fetch("/api/tasks", {
            method: "DELETE",
            body: JSON.stringify({ taskId: task.id }),
          }).then(() => {
            onDeleteTask(task.id);
          });
        }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </div>
  );
}
