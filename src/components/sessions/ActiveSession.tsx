"use client";

import { faDoorOpen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
    <div className="w-4/5 pb-10">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-row items-center gap-4 text-xl">
          <h1 className={`cursor-pointer`} onClick={() => setHidden(!hidden)}>
            #
            {hidden
              ? new Array(session.token.length).fill("*").join("")
              : session.token}
          </h1>
          <button onClick={() => {
            document.cookie = `session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            window.location.href = "/";
          }}>
            <FontAwesomeIcon icon={faDoorOpen} />
          </button>

        </div>

        <span className="text-gray-200">Créé le {new Date(session.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="h-8" />
      <div className="flex flex-col sm:px-16  items-stretch justify-center gap-16 sm:flex-row">
        <div className="flex flex-col gap-y-2 basis-0 grow">
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
        <div className="flex flex-col basis-0 grow gap-y-2">
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
