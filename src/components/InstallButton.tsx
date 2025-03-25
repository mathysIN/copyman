"use client";

import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredEvent, setDeferredEvent] = useState<Event | null>(null);

  useEffect(() => {
    const beforeInstallPromptHandler = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e); // Store the event for later use
    };

    // Add event listener for the beforeinstallprompt
    window.addEventListener("beforeinstallprompt", beforeInstallPromptHandler);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        beforeInstallPromptHandler,
      );
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredEvent) {
      (deferredEvent as any).prompt(); // Show the install prompt
    }
  };

  if (!deferredEvent) return null;

  return (
    <div>
      <button id="install-button" onClick={handleInstallClick}>
        Install App
      </button>
    </div>
  );
}
