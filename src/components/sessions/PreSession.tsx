"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import type { SessionType } from "~/server/db/redis";
import { useSearchParams } from "next/navigation";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/utils/helpers";

import imageCreate from "~/../public/create.png";
import imageInSession from "~/../public/insession.png";
import imageSharing from "~/../public/sharing.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
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

export function PreSession() {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [sessionValue, setSessionValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [joinSession, setJoinSession] = useState(
    () => localStorage.getItem("joinSession") === "true",
  );
  useEffect(() => {
    localStorage.setItem("joinSession", joinSession.toString());
  }, [joinSession]);
  const [errorMessage, setErrorMessage] = useState(
    searchParams.get("msg") ?? "",
  );
  const [loading, setLoading] = useState(false);

  const sumbitForm = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef?.current?.requestSubmit();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMessage("");
    e.preventDefault();
    if (!sessionValue) {
      setErrorMessage("Session inexistante");
      return;
    }

    setLoading(true);
    const result:
      | (SessionType & {
          hasPassword: boolean;
          isValidPassword: boolean;
          createNewSession: boolean;
        })
      | undefined = await fetch(
      `/api/sessions?sessionId=${sessionValue}&password=${passwordValue}&join=${joinSession}`,
      {},
    )
      .then((res) => res.json())
      .catch(() => {});
    setLoading(false);
    if (!result) {
      setErrorMessage("Session inexistante");
      return;
    }

    if (!result.createNewSession) {
      if (!joinSession) {
        setErrorMessage("Ce nom de session est déjà utilisé");
        return;
      }
      if (result.hasPassword && !result.isValidPassword) {
        setErrorMessage("Mot de passe incorrect");
        return;
      }
    }
    formRef.current?.submit();
  };
  return (
    <>
      <form
        method="post"
        action="/api/sessions"
        className="flex h-full flex-col items-center justify-center gap-4"
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <input name="join" value={`${joinSession}`} readOnly hidden />
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row">
          <label
            htmlFor="join-session"
            className={cn(
              "w-44 cursor-pointer sm:text-right",
              joinSession && "opacity-50",
              !joinSession && "underline",
            )}
            onClick={() => setJoinSession(true)}
          >
            Créer une session
          </label>
          <Switch
            checked={joinSession}
            onCheckedChange={(v) => setJoinSession(v)}
            id="join-session"
          />
          <label
            htmlFor="join-session"
            className={cn(
              "w-44 cursor-pointer sm:text-left",
              !joinSession && "opacity-50",
              joinSession && "underline",
            )}
            onClick={() => setJoinSession(false)}
          >
            Rejoindre une session
          </label>
        </div>
        <span className="h-4 text-red-500">{errorMessage}</span>
        <span className="flex flex-row space-x-[1px] rounded-xl border-blue-600 bg-white p-2 text-black">
          <span className="w-6 px-1">#</span>
          <div className="h-1" />
          <input
            name="session"
            type="password"
            value={sessionValue}
            onChange={(e) => setSessionValue(e.target.value)}
            onKeyDown={sumbitForm}
            className="outline-none"
            placeholder="session"
          />
          <input name="create" defaultValue="true" hidden />
        </span>
        <span className="flex flex-row space-x-[1px] rounded-xl border-blue-600 bg-white p-2 text-black">
          <span className="w-6 px-1">**</span>
          <div className="h-1" />
          <input
            name="password"
            type="password"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            onKeyDown={sumbitForm}
            className="outline-none"
            placeholder="mot de passe"
          />
        </span>
        <div className="h-2" />
        <div className="flex w-full flex-col items-center justify-center">
          <button
            type="submit"
            className="flex flex-row items-center justify-center space-x-4 rounded-md border-2 border-dashed border-white bg-white bg-opacity-5 px-2 py-2 hover:bg-opacity-10 active:scale-95"
          >
            <p className="min-w-32 py-[2px] text-2xl font-bold">
              {joinSession && "Rejoindre"}
              {!joinSession && "Créer"}
            </p>
            <Image src="/logo.png" width={50} height={50} alt="logo" />
            {loading && (
              <div role="status">
                <svg
                  aria-hidden="true"
                  className="h-8 w-8 animate-spin fill-white text-gray-200 dark:text-gray-600"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>
              </div>
            )}
          </button>
        </div>
      </form>
      <div className="h-20" />

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
                    <p>
                      Créez une session avec un identifiant et un mot de passe
                    </p>
                  </div>
                  <Image src={imageCreate} className="w-96" alt="logo" />
                </div>
                <div className="flex flex-col items-center font-bold">
                  <div className="flex flex-col items-center">
                    <p className="text-5xl italic">2</p>
                    <p>Ajoutez vos textes et fichiers</p>
                  </div>
                  <Image src={imageInSession} className="w-96" alt="logo" />
                </div>
                <div className="flex flex-col items-center font-bold">
                  <div className="flex flex-col items-center">
                    <p className="text-5xl italic">3</p>
                    <p className="w-80 text-center">{`Rejoignez la session temps réel avec d'autres appareils en quelques cliques`}</p>
                  </div>
                  <Image src={imageSharing} className="w-96" alt="logo" />
                </div>
              </div>
              <div className="px-8 text-center">
                <p className="py-2">
                  {
                    "Copyman permet de partager facilement du contenu en temps réel via des sessions. Pas besoin de compte, tout est rapide et pratique. Parfait pour une utilisation simple et collaborative."
                  }
                </p>
                <p className="py-2">
                  {
                    "La plateforme est encore en développement (et le code est bien naze) mais l'objectif serait de la peaufiner."
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
