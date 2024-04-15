"use client";

import { faDoorOpen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { AddNewTask } from "~/components/AddNewTask";
import ContentRenderer from "~/components/ContentRenderer";
import { Task } from "~/components/Task";
import UploadContent from "~/components/UploadContent";
import {
  AttachmentType,
  ContentType,
  NoteType,
  SessionType,
} from "~/server/db/redis";

export function ActiveSession({
  session,
  sessionContents,
}: {
  session: SessionType;
  sessionContents: ContentType[];
}) {
  const [hidden, setHidden] = useState(true);
  const [cachedContents, setCachedContents] =
    useState<ContentType[]>(sessionContents);
  return (
    <div className="w-4/5 pb-10">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-row items-center gap-4 text-xl">
          <h1 className={`cursor-pointer`} onClick={() => setHidden(!hidden)}>
            #
            {hidden
              ? new Array(session.sessionId.length).fill("*").join("")
              : session.sessionId}
          </h1>
          <button
            onClick={() => {
              document.cookie = `session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
              window.location.href = "/";
            }}
          >
            <FontAwesomeIcon icon={faDoorOpen} />
          </button>
        </div>

        <span className="text-gray-200">
          Créé le {new Date(parseInt(session.createdAt)).toLocaleDateString()}
        </span>
      </div>
      <div className="h-8" />
      <div className="flex flex-col items-stretch  justify-center gap-16 sm:flex-row sm:px-16">
        <div className="flex grow basis-0 flex-col gap-y-2">
          <h2>Trucs</h2>{" "}
          <UploadContent
            onNewContent={(content) =>
              setCachedContents([content, ...cachedContents])
            }
          />
          {cachedContents
            .filter(
              (c: ContentType): c is AttachmentType => c.type == "attachment",
            )
            .map((content) => (
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
        <div className="flex grow basis-0 flex-col gap-y-2">
          <h2>Autres trucs</h2>
          <AddNewTask
            onNewContent={(content) =>
              setCachedContents([content, ...cachedContents])
            }
          />
          {cachedContents
            .filter((c: ContentType): c is NoteType => c.type == "note")
            .map((task) => (
              <Task
                key={task.id}
                content={task}
                onDeleteTask={() => {
                  setCachedContents(
                    cachedContents.filter((c) => c.id !== task.id),
                  );
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
