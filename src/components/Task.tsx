"use client";

import { faLink, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import {
  areSetEqual,
  extractLinksFromString,
  getLinkMetadataFromClient,
} from "~/lib/utils";
import type { NoteType } from "~/server/db/redis";
import TextareaAutosize from "react-textarea-autosize";
import DOMPurify from "dompurify";

function _renderMarkdown(markdown: string): string {
  const headerRegex = /^(#+)\s(.+)/gm;
  const boldRegex = /\*\*(.*?)\*\*/g;
  const italicRegex = /_(.*?)_/g;
  const underlineRegex = /__(.*?)__/g;
  const codeBlockRegex = /```([^```]+)```/g;

  markdown = markdown.replace(headerRegex, (match, level, content) => {
    const headerLevel = level.length;
    return `<h${headerLevel}>${content}</h${headerLevel}>`;
  });

  markdown = markdown.replace(boldRegex, "<strong>$1</strong>");
  markdown = markdown.replace(italicRegex, "<em>$1</em>");
  markdown = markdown.replace(underlineRegex, "<u>$1</u>");
  markdown = markdown.replace(codeBlockRegex, "<pre><code>$1</code></pre>");
  markdown = markdown.replace(/\n/g, "<br>");

  return markdown;
}

const REQUEST_DELAY = 800;

type LinksWithMeta = {
  link: string;
  metadata: {
    image?: string;
    title: string;
  };
};

export function Task({
  content,
  onDeleteTask = () => {},
  onUpdateTask = () => {},
}: {
  content: NoteType;
  onDeleteTask: (taskId: string) => any;
  onUpdateTask: (task: NoteType) => any;
}) {
  const [value, setValue] = useState(content.content ?? "");
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<Set<string>>();
  const [linksWithMeta, setLinksWithMetaData] = useState<LinksWithMeta[]>([]);
  const [renderedMarkdown, setRenderedMarkdown] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = async () => {
    setIsFocused(false);
    renderMarkdown();
  };

  const renderMarkdown = async () => {
    setRenderedMarkdown(DOMPurify.sanitize(_renderMarkdown(value)));
  };

  useEffect(() => {
    renderMarkdown();
  }, []);

  const onMarkdownRenderClick = () => {
    setIsFocused(true);
    textareaRef?.current?.focus();
  };

  useEffect(() => {
    const newValue = content.content ?? "";
    setValue(newValue);
    renderLinks(newValue);
  }, [content]);

  async function renderLinks(value: string) {
    const links = extractLinksFromString(value);
    if (extractedLinks && areSetEqual(links, extractedLinks)) return;
    setExtractedLinks(links);

    const _linksWithMeta: LinksWithMeta[] = [];
    [].map(() => {
      return {};
    });
    setLinksWithMetaData(
      Array.from(links).map((link) => {
        return {
          link: link,
          metadata: {
            title: new URL(link).hostname,
          },
        };
      }),
    );
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
      else
        _linksWithMeta.push({
          link: link,
          metadata: {
            title: new URL(link).hostname,
          },
        });
    }
    setLinksWithMetaData(_linksWithMeta);
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setModifying(true);
    const newValue = e.target.value;
    setValue(newValue);
    if (timerId) {
      clearTimeout(timerId);
    }
    const newTimerId = setTimeout(
      () => handleChangeEnd(newValue),
      REQUEST_DELAY,
    );
    setTimerId(newTimerId);
  };

  const handleChangeEnd = async (newValue: string) => {
    setModifying(false);

    onUpdateTask({
      ...content,
      content: newValue,
    });

    fetch("/api/notes", {
      method: "PATCH",
      body: JSON.stringify({ content: newValue, taskId: content.id }),
    }).then(() => {
      setTimerId(null);
    });

    renderLinks(newValue);
  };

  return (
    <div
      key={content.id}
      className={`${deleting && "animate-pulse cursor-wait opacity-75"} flex flex-col gap-2 rounded-md border-2 border-gray-300 bg-white px-2 py-2 text-black`}
    >
      <div className="relative flex flex-row gap-2">
        <div className="flew-grow textarea relative w-full">
          <TextareaAutosize
            ref={textareaRef}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            value={value}
            className={`${deleting && "cursor-wait"} ${!isFocused && "opacity-0"} textarea h-fit w-full  flex-grow`}
            maxRows={20}
          />
          {!isFocused && (
            <div
              className="absolute inset-y-0 w-full overflow-scroll text-black"
              onClick={onMarkdownRenderClick}
              dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
            ></div>
          )}
        </div>

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
            key={link.link}
            href={link.link}
            target="_blank"
            className="flex flex-row items-center gap-2 rounded-lg border-2 bg-neutral-800 px-2 py-1 text-white"
          >
            <p>{link.metadata.title}</p>
            {link.metadata.image && (
              <img src={link.metadata.image} width={20} height={20} alt="" />
            )}
            {!link.metadata.image && (
              <FontAwesomeIcon icon={faLink} height={20} width={20} />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
