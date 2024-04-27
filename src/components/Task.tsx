"use client";

import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { link } from "fs";
import { useEffect, useState } from "react";
import {
  LinkMetadata,
  extractLinksFromString,
  getLinkMetadata,
  getLinkMetadataFromClient,
} from "~/lib/utils";
import type { NoteType } from "~/server/db/redis";
import type urlMetadata from "url-metadata";
import Image from "next/image";

const REQUEST_DELAY = 800;

type LinksWithMeta = {
  link: string;
  metadata: {
    image: string;
    title: string;
  };
};

export function Task({
  content,
  onDeleteTask = () => {},
}: {
  content: NoteType;
  onDeleteTask: (taskId: string) => any;
}) {
  const [value, setValue] = useState(content.content ?? "");
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [linksWithMeta, setLinksWithMetaData] = useState<LinksWithMeta[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setModifying(true);
    const newValue = e.target.value;
    setValue(newValue);
    if (timerId) {
      clearTimeout(timerId);
    }
    const newTimerId = setTimeout(() => editTask(newValue), REQUEST_DELAY);
    setTimerId(newTimerId);
  };

  const editTask = (newValue: string) => {
    setModifying(false);
    fetch("/api/notes", {
      method: "PATCH",
      body: JSON.stringify({ content: newValue, taskId: content.id }),
    }).then(() => {
      setTimerId(null);
    });
  };

  const links = extractLinksFromString(value);

  useEffect(() => {
    (async () => {
      const _linksWithMeta: LinksWithMeta[] = [];
      for (const link of links) {
        const metadata = await getLinkMetadataFromClient(link);
        if (
          metadata &&
          ((metadata["image"] && metadata["url"]) ||
            (metadata["favicons"] && metadata["favicons"][0])) &&
          metadata["title"]
        )
          _linksWithMeta.push({
            link: link,
            metadata: {
              title: metadata["title"],
              image: metadata["image"]
                ? metadata["url"] + metadata["image"]
                : metadata["favicons"][0]["href"],
            },
          });
      }
      setLinksWithMetaData(_linksWithMeta);
    })();
  }, [value]);

  return (
    <div
      key={content.id}
      className={`${deleting && "animate-pulse cursor-wait opacity-75"} flex flex-col gap-2 rounded-md border-2 border-gray-300 bg-white px-2 py-2 text-black`}
    >
      <div className="flex flex-row gap-2">
        <textarea
          disabled={deleting}
          value={value}
          onChange={handleChange}
          className={`${deleting && "cursor-wait"} h-fit flex-grow`}
        ></textarea>
        <button
          disabled={deleting}
          className={`${deleting && "cursor-wait"} min-w-min text-red-400`}
          onClick={async () => {
            setDeleting(true);
            fetch("/api/notes", {
              method: "DELETE",
              body: JSON.stringify({ taskId: content.id }),
            })
              .then(() => {
                onDeleteTask(content.id);
              })
              .catch(() => {
                setDeleting(false);
              });
          }}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
      <div className="flex flex-row flex-wrap">
        {linksWithMeta.map((link) => (
          <a
            href={link.link}
            target="_blank"
            className="flex flex-row items-center gap-2 rounded-lg border-2 bg-neutral-800 px-2 py-1 text-white"
          >
            <p>{link.metadata.title}</p>
            <img src={link.metadata.image} width={20} height={20} alt="" />
          </a>
        ))}
      </div>
    </div>
  );
}
