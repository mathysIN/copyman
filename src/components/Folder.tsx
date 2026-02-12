"use client";

import { useState } from "react";
import { Reorder, useDragControls, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFolderOpen,
  faChevronDown,
  faChevronUp,
  faTrash,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import type {
  FolderType,
  ContentType,
  NoteType,
  AttachmentType,
} from "~/server/db/redis";
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
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";

interface FolderProps {
  folder: FolderType;
  contents: ContentType[];
  onFolderUpdate: (folder: FolderType) => void;
  onFolderDelete: (folderId: string) => void;
  onContentReorder: (folderId: string, newOrder: ContentType[]) => void;
  onMoveContentOut: (contentId: string, folderId: string) => void;
  renderContentItem: (
    content: ContentType,
    folderId?: string,
    onMoveContentOut?: (contentId: string, folderId: string) => void,
  ) => React.ReactNode;
  socketUserId?: string;
}

export function Folder({
  folder,
  contents,
  onFolderUpdate,
  onFolderDelete,
  onContentReorder,
  onMoveContentOut,
  renderContentItem,
  socketUserId,
}: FolderProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [folderName, setFolderName] = useState(folder.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const controls = useDragControls();

  const handleNameChange = async (newName: string) => {
    if (!newName.trim()) return;

    const updatedFolder = { ...folder, name: newName };
    onFolderUpdate(updatedFolder);

    await fetch(`/api/folders`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Socket-User-Id": socketUserId ?? "",
      },
      body: JSON.stringify({ folderId: folder.id, name: newName }),
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    await fetch(`/api/folders?folderId=${folder.id}`, {
      method: "DELETE",
      headers: {
        "X-Socket-User-Id": socketUserId ?? "",
      },
    });

    onFolderDelete(folder.id);
  };

  const handleContentReorder = (newOrder: ContentType[]) => {
    const newContentIds = newOrder.map((c) => c.id);
    const updatedFolder = { ...folder, contentIds: newContentIds };
    onFolderUpdate(updatedFolder);
    onContentReorder(folder.id, newOrder);
  };

  return (
    <Reorder.Item
      value={folder}
      drag="y"
      layoutScroll={true}
      dragControls={controls}
      dragListener={false}
      layout="position"
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
    >
      <div
        className={`${isDragging && "scale-105 shadow-2xl"} ${isDeleting && "animate-pulse opacity-75"} rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 transition-all`}
      >
        {/* Folder Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-amber-600 transition-colors hover:text-amber-800"
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronUp}
                className="h-4 w-4"
              />
            </button>
            <FontAwesomeIcon
              icon={isExpanded ? faFolderOpen : faFolder}
              className="h-5 w-5 text-amber-500"
            />

            {isEditing ? (
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onBlur={() => {
                  handleNameChange(folderName);
                  setIsEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleNameChange(folderName);
                    setIsEditing(false);
                  }
                }}
                className="h-8 max-w-[200px] flex-1"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 truncate text-left font-medium text-gray-800 hover:text-amber-700"
              >
                {folder.name}
              </button>
            )}

            <span className="rounded-full bg-white/50 px-2 py-1 text-xs text-gray-500">
              {contents.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={isDeleting}
                  className="flex h-8 w-8 items-center justify-center rounded bg-red-400 text-white transition-all hover:bg-red-500 active:scale-90"
                >
                  <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer le dossier ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Les contenus du dossier seront remis à la racine. Cette
                    action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div
              className="flex cursor-grab touch-none flex-row items-center justify-center"
              onPointerDown={(e) => controls?.start(e)}
            >
              <FontAwesomeIcon
                icon={faGripVertical}
                className="h-5 w-5 text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Folder Contents */}
        <AnimatePresence>
          {isExpanded && contents.length > 0 && (
            <div className="border-t border-amber-200/50">
              <Reorder.Group
                values={contents}
                onReorder={handleContentReorder}
                className="flex flex-col gap-2 bg-white/30 p-3"
              >
                {contents.map((content) => (
                  <div key={content.id} className="group relative">
                    {renderContentItem(content, folder.id, onMoveContentOut)}
                  </div>
                ))}
              </Reorder.Group>
            </div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {isExpanded && contents.length === 0 && (
          <div className="border-t border-amber-200/50 p-4 text-center text-sm text-gray-500">
            Glissez des éléments ici
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}

interface CreateFolderButtonProps {
  targetType: "note" | "attachment";
  onCreateFolder: (folder: FolderType) => void;
  socketUserId?: string;
  sessionId: string;
}

export function CreateFolderButton({
  targetType,
  onCreateFolder,
  socketUserId,
  sessionId,
}: CreateFolderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!folderName.trim()) return;

    setIsCreating(true);

    const response = await fetch("/api/folders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Socket-User-Id": socketUserId ?? "",
      },
      body: JSON.stringify({
        name: folderName,
        targetType,
        sessionId,
      }),
    });

    if (response.ok) {
      const folder = await response.json();
      onCreateFolder(folder as FolderType);
      setFolderName("");
      setIsOpen(false);
    }

    setIsCreating(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 transition-colors hover:bg-amber-200">
          <FontAwesomeIcon icon={faFolder} />
          Nouveau dossier
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un dossier</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="Nom du dossier"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!folderName.trim() || isCreating}
          >
            {isCreating ? "Création..." : "Créer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MoveToFolderDialogProps {
  content: ContentType;
  folders: FolderType[];
  onMove: (contentId: string, folderId: string | null) => void;
  socketUserId?: string;
}

export function MoveToFolderDialog({
  content,
  folders,
  onMove,
  socketUserId,
}: MoveToFolderDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleMove = async (folderId: string | null) => {
    await fetch(`/api/content/move`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Socket-User-Id": socketUserId ?? "",
      },
      body: JSON.stringify({
        contentId: content.id,
        folderId,
      }),
    });

    onMove(content.id, folderId);
    setIsOpen(false);
  };

  const currentFolderId =
    content.type === "note" || content.type === "attachment"
      ? content.folderId
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="w-8 rounded bg-neutral-100 py-1 transition-all hover:bg-neutral-200 active:scale-90 active:opacity-75">
          <FontAwesomeIcon icon={faFolder} className="text-amber-600" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déplacer vers un dossier</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-4">
          {currentFolderId && (
            <button
              onClick={() => handleMove(null)}
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
            >
              <FontAwesomeIcon
                icon={faFolder}
                className="h-5 w-5 text-gray-400"
              />
              <span>À la racine</span>
            </button>
          )}

          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => handleMove(folder.id)}
              disabled={folder.id === currentFolderId}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                folder.id === currentFolderId
                  ? "cursor-default border-amber-300 bg-amber-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <FontAwesomeIcon
                icon={faFolder}
                className="h-5 w-5 text-amber-500"
              />
              <span>{folder.name}</span>
              {folder.id === currentFolderId && (
                <span className="ml-auto text-xs text-amber-600">Actuel</span>
              )}
            </button>
          ))}

          {folders.length === 0 && !currentFolderId && (
            <p className="py-4 text-center text-gray-500">
              Aucun dossier disponible
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
