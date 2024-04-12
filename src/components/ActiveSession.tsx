"use client";

import { useState } from "react";
import { AddNewTask } from "~/components/AddNewTask";
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
  console.log("found ", sessionContents.length);
  const [hidden, setHidden] = useState(true);
  const [cachedTasks, setCachedTasks] = useState<tasksType[]>([]);
  return (
    <div className="w-72">
      <h1 className={`cursor-pointer`} onClick={() => setHidden(!hidden)}>
        #
        {hidden
          ? new Array(session.token.length).fill("*").join("")
          : session.token}
      </h1>
      <span className="text-gray-200">id: {session.id}</span>
      <UploadContent />
      <h2>Trucs</h2>
      <div className="flex flex-col gap-y-2">
        {sessionContents.map((content) => (
          <div key={content.id} className="flex gap-x-2">
            <span>{content.contentURL}</span>
            <button
              onClick={() => {
                fetch(`/api/content?contentId=${content.id}`, {
                  method: "DELETE",
                });
              }}
            >
              Delete
            </button>
          </div>
        ))}
        {sessionTasks.map((task) => (
          <Task key={task.id} task={task} />
        ))}
        {cachedTasks.map((task) => (
          <Task key={task.id} task={task} />
        ))}
        <AddNewTask
          onNewTask={(task) => setCachedTasks([...cachedTasks, task])}
        />
      </div>
    </div>
  );
}
