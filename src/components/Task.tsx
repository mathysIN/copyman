"use client";

import { faCopy, faLink, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import {
  areSetEqual,
  cn,
  extractLinksFromString,
  getLinkMetadataFromClient,
} from "~/lib/utils";
import type { NoteType } from "~/server/db/redis";
import TextareaAutosize from "react-textarea-autosize";
import he from "he";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

function _renderMarkdown(markdown: string): string {
  const headerRegex = /^(#+)\s(.+)/gm;
  const boldRegex = /\*\*(.*?)\*\*/g;
  const italicRegex = /_(.*?)_/g;
  const underlineRegex = /__(.*?)__/g;
  const codeBlockRegex = /```([^`]+)```/g;
  markdown = markdown.replace(headerRegex, (match, level, content) => {
    const headerLevel = level.length;
    return `<h${headerLevel}>${content}</h${headerLevel}>`;
  });

  markdown = markdown.replace(boldRegex, "<strong>$1</strong>");
  markdown = markdown.replace(italicRegex, "<em>$1</em>");
  markdown = markdown.replace(underlineRegex, "<u>$1</u>");
  markdown = markdown.replace(codeBlockRegex, "<pre><code>$1<br></code></pre>");
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
  const [pleaseDontFocusBro, setPleaseDontFocusBro] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = async () => {
    setIsFocused(false);
    renderMarkdown();
  };

  const renderMarkdown = async () => {
    setRenderedMarkdown(_renderMarkdown(he.encode(value, {})));
  };

  useEffect(() => {
    renderMarkdown();
  }, []);

  const onMarkdownRenderClick = () => {
    if (pleaseDontFocusBro) return;
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

  const handleChange = () => {
    setModifying(true);
    const newValue = textareaRef?.current?.value;
    if (!newValue) return;
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

  const handleCheckboxChange = (index: number) => {
    const lines = value.split("\n");
    const newLines = lines.map((line, i) => {
      if (index === i) {
        return line.startsWith("- [ ]")
          ? `- [x]${line.slice(5)}`
          : `- [ ]${line.slice(5)}`;
      }
      return line;
    });
    if (textareaRef.current?.value)
      textareaRef.current.value = newLines.join("\n");
  };

  const renderListItem = ({ children, ...props }: any) => {
    const index = parseInt(props.node.position.start.line, 10) - 1;
    const lineContent = value.split("\n")[index];
    if (!lineContent) return <></>;

    return (
      <li>
        <input
          type="checkbox"
          checked={lineContent.startsWith("- [x]")}
          onClick={(e) => {
            e.stopPropagation();
            handleCheckboxChange(index);
            handleChange();
          }}
        />{" "}
        {lineContent.slice(6).trim()}
      </li>
    );
  };

  return (
    <div
      key={content.id}
      className={`${deleting && "animate-pulse cursor-wait opacity-75"} flex flex-col gap-2 rounded-md border-2 border-gray-300 bg-white px-2 py-2 text-black`}
    >
      <div className="relative flex flex-col gap-2">
        <div className="flew-grow textarea relative w-full">
          <TextareaAutosize
            ref={textareaRef}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            value={value}
            className={`${deleting && "cursor-wait"} ${!isFocused && "opacity-0"} textarea h-fit w-full flex-grow border-2`}
            maxRows={20}
          />
          {!isFocused && (
            <div
              className="absolute inset-y-0 w-full overflow-hidden overflow-x-hidden break-words border-2 border-neutral-100 text-black"
              onClick={onMarkdownRenderClick}
            >
              <ReactMarkdown
                remarkPlugins={[remarkBreaks, remarkGfm]}
                children={value}
                // children={value.replace(/(?<=\n\n)(?![*-])/gi, "&nbsp;\n ")}
                components={{
                  li: renderListItem,
                  pre({ node, children, className, ...props }) {
                    return (
                      <div className="relative">
                        <pre
                          className={cn(className, "overflow-x-scroll")}
                          {...props}
                        >
                          <br />
                          {children}
                          <br />
                        </pre>
                      </div>
                    );
                  },
                  code({ node, children, ...props }) {
                    return (
                      <>
                        <button
                          className="absolute right-0 top-0 m-1 rounded-md bg-white px-2 py-1 text-black active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(`${children}`);
                          }}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                        {children}
                      </>
                    );
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>
      {linksWithMeta.length > 0 && (
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
      )}

      <div className="flex flex-row justify-start gap-x-2">
        <button
          className="text-black active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(value);
          }}
        >
          <FontAwesomeIcon icon={faCopy} />
        </button>
        <button
          disabled={deleting}
          className={`${deleting && "cursor-wait"} min-w-min text-red-400 active:scale-95`}
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
    </div>
  );
}
