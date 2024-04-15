"use client";

import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { NoteType } from "~/server/db/redis";

const REQUEST_DELAY = 800;

export function Task({
  content,
  onDeleteTask = () => {},
}: {
  content: NoteType;
  onDeleteTask: (taskId: string) => any;
}) {
  const [value, setValue] = useState(content.content ?? "");
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (timerId) {
      clearTimeout(timerId);
    }
    const newTimerId = setTimeout(() => editTask(newValue), REQUEST_DELAY);
    setTimerId(newTimerId);
  };

  const editTask = (newValue: string) => {
    fetch("/api/notes", {
      method: "PATCH",
      body: JSON.stringify({ content: newValue, taskId: content.id }),
    }).then(() => {
      setTimerId(null);
    });
  };

  return (
    <div
      key={content.id}
      className="flex flex-row gap-2 rounded-md border-2 border-gray-300 bg-white px-2 py-2 text-black"
    >
      <textarea
        value={value}
        onChange={handleChange}
        className="h-fit flex-grow"
      ></textarea>
      <button
        onClick={() => {
          fetch("/api/notes", {
            method: "DELETE",
            body: JSON.stringify({ taskId: content.id }),
          }).then(() => {
            onDeleteTask(content.id);
          });
        }}
        className="min-w-min text-red-400"
      >
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </div>
  );
}
