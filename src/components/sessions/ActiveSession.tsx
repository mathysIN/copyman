"use client";

import { useState } from "react";
import { AddNewTask } from "~/components/AddNewTask";
import ContentRenderer from "~/components/ContentRenderer";
import { Task } from "~/components/Task";
import UploadContent from "~/components/UploadContent";
import type { contentType, sessionType, tasksType } from "~/server/db/schema";

export function ActiveSession({
  session,
  sessionTasks,
  sessionContents,
}: {
  session: sessionType;
  sessionTasks: tasksType[];
  sessionContents: contentType[];
}) {
  const [hidden, setHidden] = useState(true);
  const [cachedTasks, setCachedTasks] = useState<tasksType[]>(sessionTasks);
  const [cachedContents, setCachedContents] =
    useState<contentType[]>(sessionContents);
  return (
    <div className="w-96">
      <div className="flex flex-col items-center justify-center">
        <h1 className={`cursor-pointer`} onClick={() => setHidden(!hidden)}>
          #
          {hidden
            ? new Array(session.token.length).fill("*").join("")
            : session.token}
        </h1>
        <span className="text-gray-200">id: {session.id}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 cursor-pointer text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          onClick={() => {
            document.cookie = `session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            window.location.href = "/";
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
      <div className="h-8" />
      <div className="flex flex-col justify-center gap-16 sm:flex-row">
        <div className="flex flex-col gap-y-2">
          <h2>Trucs</h2>{" "}
          <UploadContent
            onNewContent={(content) =>
              setCachedContents([content, ...cachedContents])
            }
          />
          {cachedContents.map((content) => (
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
        <div className="flex flex-col gap-y-2">
          <h2>Autres trucs</h2>
          <AddNewTask
            onNewTask={(task) => setCachedTasks([task, ...cachedTasks])}
          />
          {cachedTasks.map((task) => (
            <Task
              key={task.id}
              task={task}
              onDeleteTask={() => {
                setCachedTasks(cachedTasks.filter((t) => t.id !== task.id));
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
