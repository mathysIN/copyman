"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { FolderType } from "~/server/db/redis";

interface MultiselectActionBarProps {
  selectedCount: number;
  selectedType: "note" | "attachment" | "mixed" | null;
  folders: FolderType[];
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function MultiselectActionBar({
  selectedCount,
  selectedType,
  folders,
  onMove,
  onDelete,
  onCancel,
}: MultiselectActionBarProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredFolders = selectedType
    ? folders.filter((f) => f.targetType === selectedType)
    : folders;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border-2 border-gray-200 bg-white px-5 py-3 shadow-2xl">
        <span className="whitespace-nowrap text-sm font-medium text-gray-600">
          {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
        </span>

        <div className="h-6 w-px bg-gray-200" />

        <button
          onClick={() => setShowMoveDialog(true)}
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

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50"
        >
          <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
          <span>Supprimer</span>
        </button>

        <div className="h-6 w-px bg-gray-200" />

        <button
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
        >
          <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          <span>Annuler</span>
        </button>
      </div>

      {showMoveDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
          onClick={() => setShowMoveDialog(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl border bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-semibold">
              Déplacer vers un dossier
            </h3>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              <button
                onClick={() => {
                  onMove(null);
                  setShowMoveDialog(false);
                }}
                className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
              >
                <FontAwesomeIcon
                  icon={faFolder}
                  className="h-5 w-5 text-gray-400"
                />
                <span>À la racine</span>
              </button>
              {filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    onMove(folder.id);
                    setShowMoveDialog(false);
                  }}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-gray-50"
                >
                  <FontAwesomeIcon
                    icon={faFolder}
                    className="h-5 w-5 text-amber-500"
                  />
                  <span>{folder.name}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {folder.targetType === "note" ? "Notes" : "Fichiers"}
                  </span>
                </button>
              ))}
              {filteredFolders.length === 0 && (
                <p className="py-4 text-center text-gray-500">
                  Aucun dossier disponible
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl border bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold">
              Supprimer {selectedCount} élément{selectedCount > 1 ? "s" : ""} ?
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              Cette action ne pourra pas être annulée.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
