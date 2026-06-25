"use client";

import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faFolder,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { FolderType } from "~/server/db/redis";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogTrigger,
} from "~/components/ui/dialog";
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

interface MultiselectActionBarProps {
  selectedCount: number;
  selectedType: "note" | "attachment" | "mixed" | null;
  folders: FolderType[];
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
  onDownload: () => void;
  onCancel: () => void;
}

function MoveFolderList({
  folders,
  onMove,
}: {
  folders: FolderType[];
  onMove: (folderId: string | null) => void;
}) {
  return (
    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
      <DialogClose asChild>
        <button
          onClick={() => onMove(null)}
          className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
        >
          <FontAwesomeIcon icon={faFolder} className="h-5 w-5 text-gray-400" />
          <span>À la racine</span>
        </button>
      </DialogClose>
      {folders.map((folder) => (
        <DialogClose key={folder.id} asChild>
          <button
            onClick={() => onMove(folder.id)}
            className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
          >
            <FontAwesomeIcon icon={faFolder} className="h-5 w-5 text-amber-500" />
            <span>{folder.name}</span>
            <span className="ml-auto text-xs text-gray-400">
              {folder.targetType === "note" ? "Notes" : "Fichiers"}
            </span>
          </button>
        </DialogClose>
      ))}
      {folders.length === 0 && (
        <p className="py-4 text-center text-gray-500">
          Aucun dossier disponible
        </p>
      )}
    </div>
  );
}

export function MultiselectActionBar({
  selectedCount,
  selectedType,
  folders,
  onMove,
  onDelete,
  onDownload,
  onCancel,
}: MultiselectActionBarProps) {
  const filteredFolders = selectedType
    ? folders.filter((f) => f.targetType === selectedType)
    : folders;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-5 py-3 shadow-2xl">
        <span className="whitespace-nowrap text-sm font-medium text-gray-600">
          {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
        </span>

        <div className="h-6 w-px bg-gray-200" />

        <Dialog>
          <DialogTrigger asChild>
            <button
              disabled={selectedType === "mixed"}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-amber-600 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                selectedType === "mixed"
                  ? "Impossible de déplacer des types mixtes"
                  : "Déplacer vers un dossier"
              }
            >
              <FontAwesomeIcon icon={faFolder} className="h-4 w-4" />
              <span>Déplacer</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Déplacer vers un dossier</DialogTitle>
              <DialogDescription>
                Choisissez un dossier de destination pour les éléments
                sélectionnés.
              </DialogDescription>
            </DialogHeader>
            <MoveFolderList
              folders={filteredFolders}
              onMove={onMove}
            />
          </DialogContent>
        </Dialog>

        <button
          onClick={onDownload}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-blue-600 transition-colors hover:bg-blue-50"
          title="Télécharger les fichiers sélectionnés"
        >
          <FontAwesomeIcon icon={faDownload} className="h-4 w-4" />
          <span>Télécharger</span>
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50">
              <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
              <span>Supprimer</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer {selectedCount} élément
                {selectedCount > 1 ? "s" : ""} ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action ne pourra pas être annulée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-red-500 hover:bg-red-600"
              >
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="h-6 w-px bg-gray-200" />

        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
        >
          <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          <span>Annuler</span>
        </button>
      </div>,
    document.body
  );
}
