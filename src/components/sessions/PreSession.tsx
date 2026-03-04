"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import type { SessionType } from "~/server/db/redis";
import { useSearchParams } from "next/navigation";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { cn } from "~/utils/helpers";
import { deriveAuthKey, deriveEncKey } from "~/lib/client/encryption";

import imageCreate from "~/../public/create.png";
import imageInSession from "~/../public/insession.png";
import imageSharing from "~/../public/sharing.png";
import imageLogo from "~/../public/logo.png";
import imageCreateSession from "~/../public/create-session.png";
import imageJoinSession from "~/../public/join-session.png";
import imageTemporarySession from "~/../public/temporary-session.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faQuestionCircle,
  faAngleLeft,
  faDesktop,
  faTerminal,
  faMobileScreen,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Loading } from "~/components/Loading";
import InstallButton from "~/components/InstallButton";

export function PreSession() {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [sessionValue, setSessionValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [joinSession, setJoinSession] = useState<
    "join" | "create" | undefined
  >();
  const [errorMessage, setErrorMessage] = useState(
    searchParams.get("msg") ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [tempLoading, setTempLoading] = useState(false);
  const [enableEncryption, setEnableEncryption] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      (installPrompt as any).prompt();
    }
  };

  const sumbitForm = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef?.current?.requestSubmit();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMessage("");
    e.preventDefault();
    if (loading) return;
    if (!sessionValue) {
      setErrorMessage("Session inexistante");
      return;
    }

    setLoading(true);

    // First, check if session exists and get session info (including createdAt)
    const checkResult: {
      valid: boolean;
      hasPassword: boolean;
      isEncrypted: boolean;
      createNewSession: boolean;
      createdAt?: string;
    } = await fetch(`/api/sessions?sessionId=${sessionValue}`)
      .then((res) => res.json())
      .catch(() => ({ valid: false, createNewSession: false }));

    if (!checkResult || (!checkResult.createNewSession && !joinSession)) {
      setLoading(false);
      if (!checkResult?.createNewSession && joinSession === "create") {
        setErrorMessage("Ce nom de session est déjà utilisé");
      } else if (
        checkResult?.createNewSession === false &&
        joinSession === "join"
      ) {
        setErrorMessage("Session inexistante");
      } else {
        setErrorMessage("Erreur lors de la vérification de la session");
      }
      return;
    }

    // Derive authKey and encKey from password
    let authKey: string | undefined;
    let encKey: CryptoKey | undefined;

    // Track the timestamp used for key derivation to ensure consistency
    let keyDerivationTimestamp: string | undefined;

    if (passwordValue) {
      if (joinSession === "join" && checkResult.createdAt) {
        // For joining, use existing session's createdAt
        keyDerivationTimestamp = checkResult.createdAt;
        authKey = await deriveAuthKey(passwordValue, keyDerivationTimestamp);
        encKey = await deriveEncKey(passwordValue, keyDerivationTimestamp);
        console.log(
          "[CLIENT JOIN] Derived keys with timestamp:",
          keyDerivationTimestamp,
          "authKey preview:",
          authKey.substring(0, 16),
        );
      } else if (joinSession === "create") {
        // For creating, use current timestamp - must be consistent between derivation and server storage
        keyDerivationTimestamp = Date.now().toString();
        authKey = await deriveAuthKey(passwordValue, keyDerivationTimestamp);
        encKey = await deriveEncKey(passwordValue, keyDerivationTimestamp);
        console.log(
          "[CLIENT CREATE] Derived keys with timestamp:",
          keyDerivationTimestamp,
          "authKey preview:",
          authKey.substring(0, 16),
        );
      }
    }

    // Verify auth key if session has password AND user entered a password
    if (checkResult.hasPassword && joinSession === "join" && passwordValue) {
      const verifyResult = await fetch(
        `/api/sessions/verify-password?sessionId=${sessionValue}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authKey }),
        },
      ).then((res) => res.json());

      if (!verifyResult.valid) {
        setLoading(false);
        setErrorMessage("Mot de passe incorrect");
        return;
      }
    }

    console.log(
      "[E2EE] Creating/joining session with encryption:",
      enableEncryption && joinSession === "create",
    );

    // Join/create session with authKey in POST body
    const postResult = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        session: sessionValue,
        authKey,
        join: joinSession === "join",
        create: "true",
        isEncrypted: enableEncryption && joinSession === "create",
        createdAt:
          joinSession === "create" && keyDerivationTimestamp
            ? keyDerivationTimestamp
            : undefined,
      }),
    }).then((res) => res.json());

    if (postResult?.error) {
      setLoading(false);
      if (postResult.error === "session_exists") {
        setErrorMessage("Ce nom de session est déjà utilisé");
      } else if (
        postResult.error === "invalid_auth_key" ||
        postResult.error === "auth_key_required"
      ) {
        setErrorMessage("Mot de passe incorrect");
      } else {
        setErrorMessage("Erreur lors de la création de la session");
      }
      return;
    }

    // Store encryption key for E2EE auto-enable
    // Export the key and store in sessionStorage (not localStorage) for security
    if (encKey && (enableEncryption || checkResult.isEncrypted)) {
      console.log("[PreSession] Storing encryption key for E2EE auto-enable");
      const { exportKey } = await import("~/lib/client/encryption");
      const exportedKey = await exportKey(encKey);
      sessionStorage.setItem(
        `e2ee_key_${sessionValue.toLowerCase()}`,
        exportedKey,
      );
    }

    setLoading(false);
    window.location.href = "/";
  };

  const handleCreateTempSession = async () => {
    setErrorMessage("");
    if (tempLoading) return;

    setTempLoading(true);

    const postResult = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        temporary: "true",
      }),
    }).then((res) => res.json());

    if (postResult?.error) {
      setTempLoading(false);
      setErrorMessage("Erreur lors de la création de la session temporaire");
      return;
    }

    setTempLoading(false);
    window.location.href = "/";
  };

  return (
    <>
      <form
        className="flex h-full flex-col items-center justify-center gap-4"
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <div className="h-12" />
        {joinSession && (
          <>
            <button
              type="button"
              onClick={() => setJoinSession(undefined)}
              className="flex flex-row items-center gap-2 underline opacity-75"
            >
              <FontAwesomeIcon icon={faAngleLeft} className="mt-1" />
              <p>retour</p>
            </button>
            <p className="h-4 text-red-500">{errorMessage}</p>
            <span className="flex flex-row space-x-[1px] rounded-xl border-blue-600 bg-white p-2 text-black">
              <span className="w-6 px-1">#</span>
              <div className="h-1" />
              <input
                type="text"
                value={sessionValue}
                onChange={(e) => setSessionValue(e.target.value)}
                onKeyDown={sumbitForm}
                className="outline-none"
                placeholder="session"
              />
            </span>
            <span className="flex flex-row space-x-[1px] rounded-xl border-blue-600 bg-white p-2 text-black">
              <span className="w-6 px-1">**</span>
              <div className="h-1" />
              <input
                type="password"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                onKeyDown={sumbitForm}
                className="outline-none"
                placeholder="mot de passe"
              />
            </span>
            {joinSession === "create" && (
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  checked={enableEncryption}
                  onCheckedChange={setEnableEncryption}
                  id="encryption-toggle"
                />
                <Label htmlFor="encryption-toggle" className="cursor-pointer">
                  Chiffrement de bout en bout (E2EE)
                </Label>
              </div>
            )}
            <div className="h-2" />
            <div className="flex w-full flex-col items-center justify-center">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full flex-row items-center justify-between space-x-4 rounded-md border-2 border-dashed border-white bg-white bg-opacity-5 px-2 py-2 hover:bg-opacity-10 active:scale-95 active:bg-opacity-30 disabled:opacity-50"
              >
                <p className="min-w-32 py-[2px] text-2xl font-bold">
                  {joinSession == "create" ? "Créer" : "Rejoindre"}
                </p>
                <div className="flex flex-1 justify-center">
                  <Image src={imageLogo} height={60} alt="logo" />
                </div>
                {loading && <Loading />}
              </button>
            </div>
          </>
        )}
        {!joinSession && (
          <>
            <div className="flex w-full flex-col items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setJoinSession("create")}
                disabled={loading}
                className="flex w-full flex-row items-center justify-between space-x-4 rounded-md border-2 border-dashed border-white bg-white bg-opacity-5 px-2 py-2 hover:bg-opacity-10 active:scale-95 active:bg-opacity-30 disabled:opacity-50"
              >
                <div className="flex w-max flex-col justify-center">
                  <p className="min-w-32 text-2xl font-bold">{"Créer"}</p>
                  <span className="text-xs">{"une nouvelle session"}</span>
                </div>

                <div className="flex flex-1 justify-center">
                  <Image
                    src={imageCreateSession}
                    height={60}
                    className="invert"
                    alt="logo"
                  />
                </div>
                {loading && <Loading />}
              </button>

              <button
                type="button"
                onClick={handleCreateTempSession}
                disabled={tempLoading}
                className="flex w-full flex-row items-center justify-between space-x-4 rounded-md border-2 border-dashed border-yellow-400 bg-yellow-400 bg-opacity-10 px-2 py-2 hover:bg-opacity-20 active:scale-95 active:bg-opacity-30 disabled:opacity-50"
              >
                <div className="flex w-max flex-col justify-center">
                  <p className="min-w-32 text-2xl font-bold text-yellow-400">
                    {"Instantané"}
                  </p>
                  <span className="text-xs text-yellow-300">
                    {"session temporaire (4h)"}
                  </span>
                </div>

                <div className="flex flex-1 justify-center">
                  <Image src={imageTemporarySession} height={60} alt="logo" />
                </div>
                {tempLoading && <Loading />}
              </button>
            </div>

            <div className="w-full border-b-2 border-white border-opacity-50" />

            <div className="flex w-full flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setJoinSession("join")}
                disabled={loading}
                className="flex w-full flex-row items-center justify-between space-x-4 rounded-md border-2 border-dashed border-white bg-white bg-opacity-5 px-2 py-2 hover:bg-opacity-10 active:scale-95 active:bg-opacity-30 disabled:opacity-50"
              >
                <div className="ml-2 flex w-max flex-col text-left">
                  <p className="min-w-32 text-2xl font-bold">{"Rejoindre"}</p>
                  <span className="text-xs">{"une session existante"}</span>
                </div>
                <Image
                  src={imageJoinSession}
                  height={60}
                  className="invert"
                  alt="logo"
                />
                {loading && <Loading />}
              </button>
            </div>
          </>
        )}
      </form>

      <div className="h-12" />

      <div className="w-full px-4">
        <p className="mb-3 text-center text-xs text-white/60">
          Disponible sur :
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="/"
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg bg-white/5 transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon icon={faDesktop} className="text-lg" />
            <span className="text-[10px]">Web</span>
          </a>
          <a
            href="https://ldm.copyman.fr"
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg bg-white/5 transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon icon={faMobileScreen} className="text-lg" />
            <span className="text-[10px]">LDM</span>
          </a>
          <a
            href="https://github.com/mathysIN/copyman-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg bg-white/5 transition-colors hover:bg-white/10"
          >
            <FontAwesomeIcon icon={faTerminal} className="text-lg" />
            <span className="text-[10px]">CLI</span>
          </a>
          {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg bg-white/5 transition-colors hover:bg-white/10"
            >
              <FontAwesomeIcon icon={faDownload} className="text-lg" />
              <span className="text-[10px]">Installer</span>
            </button>
          )}
        </div>
      </div>

      <div className="h-8" />

      <Dialog>
        <DialogTrigger>
          <h3 className="py-2 text-center text-sm  underline">
            {"Qu'est-ce que Copyman "}
            <FontAwesomeIcon icon={faQuestionCircle} />
          </h3>
        </DialogTrigger>
        <DialogContent className="h-full max-h-full overflow-visible bg-stone-800 text-white lg:max-w-fit">
          <DialogHeader>
            <DialogTitle> {"Qu'est-ce que Copyman "}</DialogTitle>
            <div className="flex flex-col justify-center overflow-visible py-4">
              <div className="h-2" />
              <div className="flex h-full flex-col items-center justify-center">
                <div className="flex flex-col items-center text-center font-bold">
                  <div className="flex flex-col items-center">
                    <p className="text-5xl italic">1</p>
                    <p>Créez une session</p>
                  </div>
                  <Image src={imageCreate} className="w-96" alt="logo" />
                </div>
                <div className="flex flex-col items-center font-bold">
                  <div className="flex flex-col items-center">
                    <p className="text-5xl italic">2</p>
                    <p>Ajoutez vos contenus : textes et fichiers</p>
                  </div>
                  <Image src={imageInSession} className="w-96" alt="logo" />
                </div>
                <div className="flex flex-col items-center font-bold">
                  <div className="flex flex-col items-center">
                    <p className="text-5xl italic">3</p>
                    <p className="w-80 text-center">{`Rejoignez la session avec d'autres appareils`}</p>
                  </div>
                  <Image src={imageSharing} className="w-96" alt="logo" />
                </div>
              </div>
              <div className="px-8 text-center">
                <p className="py-2">
                  {
                    "Copyman permet de partager du contenu via des sessions temps réel."
                  }
                </p>
                <p className="py-2">
                  {
                    "Pas besoin de compte, tout est rapide et pratique. Parfait pour une utilisation simple et collaborative."
                  }
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>
              <Button>Dac</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="h-20" />
    </>
  );
}
