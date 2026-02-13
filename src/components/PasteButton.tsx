"use client";

import { faPaste } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";

interface PasteButtonProps {
  onPaste: (text: string) => void;
  loading?: boolean;
}

export function PasteButton({ onPaste, loading = false }: PasteButtonProps) {
  const [isPasteLoading, setIsPasteLoading] = useState(false);

  const handlePaste = async () => {
    try {
      setIsPasteLoading(true);
      const text = await navigator.clipboard.readText();
      if (text) {
        onPaste(text);
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    } finally {
      setIsPasteLoading(false);
    }
  };

  return (
    <button
      disabled={loading || isPasteLoading}
      onClick={handlePaste}
      className="flex h-16 w-12 items-center justify-center rounded-xl bg-white text-gray-700 transition-colors hover:bg-neutral-50 active:scale-95 active:opacity-95 disabled:opacity-50"
      title="Coller depuis le presse-papier"
    >
      <FontAwesomeIcon icon={faPaste} />
    </button>
  );
}
