"use client";

import {
  faCopy,
  faLink,
  faTrash,
  faArrowUpRightFromSquare,
  faExpand,
  faFolder,
  faArrowRightFromBracket,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import {
  areSetEqual,
  cn,
  extractLinksFromString,
  getLinkMetadataFromClient,
  isImageURL,
  maxStringLength,
} from "~/lib/utils";
import type {
  ContentType,
  NoteType,
  SessionType,
  FolderType,
} from "~/server/db/redis";
import TextareaAutosize from "react-textarea-autosize";
import he from "he";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { copyAndToast } from "~/lib/client/toast";
import { useToast } from "~/hooks/use-toast";
import { Reorder, useDragControls } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { MoveToFolderDialog } from "./Folder";

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

export type FramerControls = ReturnType<typeof useDragControls>;

const REQUEST_DELAY = 800;

type LinksWithMeta = {
  link: string;
  metadata: {
    image?: string;
    title: string;
  };
};

const replaceUncheckedWithChecked = (
  text: string,
  lineNumber: number,
  toggled: boolean,
) => {
  return text
    .split("\n")
    .map((line, index) => {
      if (index === lineNumber) {
        if (toggled) return line.replace("- [ ]", "- [x]");
        else return line.replace("- [x]", "- [ ]");
      }
      return line;
    })
    .join("\n");
};

export type EncryptNoteFunction = (content: string) => Promise<{
  content: string;
  isEncrypted: boolean;
  encryptedIv: string;
  encryptedSalt: string;
}>;

export type DecryptNoteFunction = (note: NoteType) => Promise<string>;

export function Task({
  session,
  content,
  allContent,
  socketUserId,
  onDeleteTask = () => {},
  onUpdateTask = () => {},
  folders,
  onMove,
  folderId,
  onMoveContentOut,
  encryptNote,
  isEncryptionEnabled,
  decryptNote,
  encryptionKey,
}: {
  session: SessionType;
  content: NoteType;
  allContent: ContentType[];
  socketUserId?: string;
  onDeleteTask?: (taskId: string) => any;
  onUpdateTask?: (task: NoteType) => any;
  folders?: FolderType[];
  onMove?: (contentId: string, folderId: string | null) => void;
  folderId?: string;
  onMoveContentOut?: (contentId: string, folderId: string) => void;
  encryptNote?: EncryptNoteFunction;
  isEncryptionEnabled?: boolean;
  decryptNote?: DecryptNoteFunction;
  encryptionKey?: CryptoKey | null;
}) {
  const { toast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [value, setValue] = useState(content.content ?? "");
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionError, setDecryptionError] = useState(false);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [extractedLinks, setExtractedLinks] = useState<Set<string>>();
  const [linksWithMeta, setLinksWithMetaData] = useState<LinksWithMeta[]>([]);
  const [renderedMarkdown, setRenderedMarkdown] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [pleaseDontFocusBro, setPleaseDontFocusBro] = useState(false);
  const controls = useDragControls();

  useEffect(() => {
    const decrypt = async () => {
      if (content.isEncrypted && !isEncryptionEnabled) {
        setIsDecrypting(false);
        setDecryptionError(false);
        setValue(
          "[Erreur de déchiffrement: Le chiffrement E2EE est désactivé]",
        );
        setDecryptedValue(null);
        return;
      }
      if (content.isEncrypted && decryptNote) {
        console.log("[E2EE] Task: decrypting note", content.id);
        setIsDecrypting(true);
        setDecryptionError(false);
        try {
          const decrypted = await decryptNote(content);
          console.log(
            "[E2EE] Task: decrypted content length:",
            decrypted.length,
          );
          setDecryptedValue(decrypted);
          setValue(decrypted);
        } catch (e) {
          console.error("[E2EE] Task: decryption failed:", e);
          setDecryptionError(true);
          setValue("[Erreur de déchiffrement]");
        }
        setIsDecrypting(false);
      } else if (!content.isEncrypted) {
        setDecryptedValue(null);
        setValue(content.content ?? "");
      }
    };
    decrypt();
  }, [
    content.id,
    content.isEncrypted,
    content.content,
    decryptNote,
    isEncryptionEnabled,
  ]);

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

  const canEdit =
    !content.isEncrypted ||
    (content.isEncrypted &&
      isEncryptionEnabled &&
      decryptNote &&
      !decryptionError);

  const onMarkdownRenderClick = () => {
    if (pleaseDontFocusBro || !canEdit) return;
    setIsFocused(true);
    textareaRef?.current?.focus();
  };

  useEffect(() => {
    if (content.isEncrypted && !isEncryptionEnabled) {
      return;
    }
    const newValue = content.content ?? "";
    setValue(newValue);
    renderLinks(newValue);
  }, [content, isEncryptionEnabled]);

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
      const copymanURL = allContent.find(
        (c) => c.type == "attachment" && c.attachmentURL == link,
      );
      if (copymanURL && copymanURL.type == "attachment") {
        _linksWithMeta.push({
          link: link,
          metadata: {
            title: copymanURL.attachmentPath,
            image: isImageURL(copymanURL.attachmentURL)
              ? copymanURL.attachmentURL
              : undefined,
          },
        });
      } else {
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
    }
    setLinksWithMetaData(_linksWithMeta);
  }
  const handleChangeEvent = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    handleChange(newValue);
  };

  const handleChangeRef = () => {
    const newValue = textareaRef?.current?.value;
    if (newValue == undefined) return;
    handleChange(newValue);
  };

  const handleChange = (newValue: string) => {
    setModifying(true);
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

    let noteData: {
      content: string;
      taskId: string;
      isEncrypted?: boolean;
      encryptedIv?: string;
      encryptedSalt?: string;
    } = {
      content: newValue,
      taskId: content.id,
    };

    if (isEncryptionEnabled && encryptNote) {
      console.log("[E2EE] Task: encrypting note content for update");
      try {
        const encrypted = await encryptNote(newValue);
        noteData = {
          content: encrypted.content,
          taskId: content.id,
          isEncrypted: encrypted.isEncrypted,
          encryptedIv: encrypted.encryptedIv,
          encryptedSalt: encrypted.encryptedSalt,
        };
        console.log("[E2EE] Task: content encrypted for update");
      } catch (e) {
        console.error("[E2EE] Task: failed to encrypt:", e);
      }
    }

    onUpdateTask({
      ...content,
      content: noteData.isEncrypted ? noteData.content : newValue,
      isEncrypted: noteData.isEncrypted,
    });

    fetch("/api/notes", {
      method: "PATCH",
      headers: {
        "X-Socket-User-Id": socketUserId ?? "",
      },
      body: JSON.stringify(noteData),
    }).then(() => {
      setTimerId(null);
    });

    renderLinks(newValue);
  };

  // FIXME: optimize and fix
  // - [ ] eaze aze az - [ ] <-- this would break it
  function replaceCheckbox(
    str: string,
    replacementStr: string,
    targetCount: number,
  ) {
    let count = 0;
    let result = "";
    let buffer = "";

    const targetStrLength = 5;
    let waitForJumpLine = false;

    for (let i = 0; i < str.length; i++) {
      buffer += str[i];
      const selectedPart = buffer.slice(-targetStrLength);

      if (!waitForJumpLine && ["- [ ]", "- [x]"].includes(selectedPart)) {
        waitForJumpLine = true;
        if (count === targetCount) {
          result += buffer.slice(0, -targetStrLength) + replacementStr;
          buffer = "";
        }
        count++;
      }
      if (selectedPart.endsWith("\n")) waitForJumpLine = false;

      if (buffer.length > targetStrLength) {
        result += buffer[0];
        buffer = buffer.slice(1);
      }
    }

    result += buffer;

    return result;
  }

  let inputNumber = 0;

  function textEditContent() {
    if (content.isEncrypted && !decryptNote) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-yellow-100 p-4 text-center text-yellow-700">
          <FontAwesomeIcon icon={faLock} className="h-8 w-8" />
          <p className="font-medium">Note chiffrée</p>
          <p className="text-sm">
            Activez le chiffrement avec le mot de passe pour déchiffrer cette
            note.
          </p>
        </div>
      );
    }

    return (
      <div className="flew-grow textarea relative w-full">
        <TextareaAutosize
          ref={textareaRef}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChangeEvent}
          value={value}
          readOnly={!canEdit}
          className={`${deleting && "cursor-wait"} border-r-2 pb-2 ${!isFocused && "opacity-0"} textarea h-fit w-full flex-grow list-disc border-2`}
          maxRows={20}
        />
        {!isFocused && (
          <div
            className={`absolute inset-y-0 w-full overflow-x-hidden break-words border-2 border-r-2 border-neutral-50 bg-neutral-100 p-1 text-black ${canEdit ? "cursor-text" : "cursor-not-allowed"}`}
            onClick={onMarkdownRenderClick}
          >
            <ReactMarkdown
              remarkPlugins={[remarkBreaks, remarkGfm]}
              // children={value}
              children={value.replace(/(?<=\n\n)(?![*-])/gi, "&nbsp;\n ")}
              components={{
                ul({ node, children, className, ...props }) {
                  return (
                    <ul className={cn(className, "list-disc pl-5")} {...props}>
                      {children}
                    </ul>
                  );
                },
                a({ node, children, className, ...props }) {
                  return (
                    <>
                      <a
                        {...props}
                        className={cn(className, "cursor-pointer underline")}
                        onClick={(e) => {
                          if (!e.ctrlKey || e.button !== 0) e.preventDefault();
                        }}
                      >
                        {children}
                      </a>
                    </>
                  );
                },
                input({ ...props }) {
                  inputNumber++;
                  const _inputNumber = inputNumber;
                  const realInputNumber = _inputNumber - 1;
                  return (
                    <input
                      onChange={() => {}}
                      {...props}
                      disabled={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (textareaRef?.current)
                          textareaRef.current.value = replaceCheckbox(
                            value,
                            props.checked ? "- [ ]" : "- [x]",
                            realInputNumber,
                          );
                        handleChangeRef();
                      }}
                    ></input>
                  );
                },
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
                        className="absolute right-0 top-0 m-1 rounded-md bg-white px-2 py-1 text-black active:scale-90 active:opacity-75"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyAndToast(toast, `${children}`);
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
    );
  }

  return (
    <Reorder.Item
      key={content.id}
      value={content}
      drag="y"
      layoutScroll={true}
      dragControls={controls}
      dragListener={false}
      layout={"position"}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
    >
      <div
        key={content.id}
        className={`${deleting && "animate-pulse cursor-wait opacity-75"} ${dragging && "scale-105 shadow-2xl"} flex flex-col gap-2 rounded-md border-2 border-gray-300 bg-white px-2 py-2 text-black transition-all`}
      >
        <div className="relative flex flex-col gap-2">{textEditContent()}</div>
        {linksWithMeta.length > 0 && (
          <div className="flex flex-row flex-wrap">
            {linksWithMeta.map((link) => (
              <a
                key={link.link}
                href={link.link}
                target="_blank"
                className="flex flex-row items-center gap-2 rounded-lg border-2 bg-neutral-800 px-2 py-1 text-white"
              >
                <p>{maxStringLength(link.metadata.title, 30)}</p>
                {link.metadata.image && (
                  <img
                    src={link.metadata.image}
                    width={20}
                    height={20}
                    alt=""
                  />
                )}
                {!link.metadata.image && (
                  <FontAwesomeIcon icon={faLink} height={20} width={20} />
                )}
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-row justify-between">
          <div className="flex flex-row gap-x-1 text-center text-sm text-black">
            <button
              aria-disabled={content.isEncrypted}
              tabIndex={content.isEncrypted ? -1 : undefined}
              className={cn(
                content.isEncrypted && "pointer-events-none text-black/40",
                "w-8 rounded bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75",
              )}
              onClick={() =>
                copyAndToast(
                  toast,
                  `${window.location.origin}/content/${session.sessionId}/${content.id}`,
                  "Le lien de la note a bien été copié",
                )
              }
              title="Copier le lien de la note"
            >
              <FontAwesomeIcon icon={faLink} />
            </button>
            <button
              className="w-8 rounded bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75"
              onClick={(e) => {
                e.stopPropagation();
                copyAndToast(
                  toast,
                  value,
                  "Le contenu de la note a bien été copié",
                );
              }}
              title="Copier le contenu de la note"
            >
              <FontAwesomeIcon icon={faCopy} />
            </button>

            <Dialog
              onOpenChange={() =>
                setTimeout(() => textareaRef.current?.blur(), 0)
              }
            >
              <DialogTrigger asChild>
                <button
                  disabled={deleting}
                  className={`${deleting && "cursor-wait"} w-8 min-w-min rounded bg-neutral-100 py-1 transition-colors hover:bg-neutral-200 active:scale-90 active:opacity-75`}
                  title="Agrandir la note"
                >
                  <FontAwesomeIcon icon={faExpand} />
                </button>
              </DialogTrigger>
              <DialogContent className="scale-105">
                {textEditContent()}
              </DialogContent>
            </Dialog>
            {folders && onMove && (
              <MoveToFolderDialog
                content={content}
                folders={folders}
                onMove={onMove}
                socketUserId={socketUserId}
              />
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={deleting}
                  className={`${deleting && "cursor-wait"} w-8 min-w-min rounded bg-red-400 py-1 text-white transition-colors hover:bg-red-500 active:scale-90 active:opacity-75`}
                  title="Supprimer la note"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Suppression : êtes-vous sûr ?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action ne pourra pas être annulée. Le contenu sera
                    définitivement retiré des serveurs de Copyman.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    autoFocus
                    onClick={async () => {
                      setDeleting(true);
                      fetch("/api/notes", {
                        method: "DELETE",
                        headers: {
                          "X-Socket-User-Id": socketUserId ?? "",
                        },
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
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div
            className="flex cursor-grab touch-none flex-row items-center justify-center"
            onPointerDown={(e) => controls?.start(e)}
          >
            <div className=" mt-[1px] cursor-grab">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-black"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="5" cy="6" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="5" cy="18" r="1.5" />
                <circle cx="10" cy="6" r="1.5" />
                <circle cx="10" cy="12" r="1.5" />
                <circle cx="10" cy="18" r="1.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}
