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
import imageLogo from "~/../public/logo.png";
import imageCreateSession from "~/../public/create-session.png";
import imageJoinSession from "~/../public/join-session.png";
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
import { Loading } from "~/components/Loading";

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
        {joinSession && (
          <>
            <button
              type="button"
              onClick={() => setJoinSession(undefined)}
              className="underline opacity-75"
            >
              retour
            </button>
            <p className="h-4 text-red-500">{errorMessage}</p>
            <input
              name="join"
              value={`${joinSession == "join"}`}
              readOnly
              hidden
            />
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
                className="flex w-full flex-row items-center justify-between space-x-4 rounded-md border-2 border-dashed border-white bg-white bg-opacity-5 px-2 py-2 hover:bg-opacity-10 active:scale-95 active:bg-opacity-30"
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
            <div className="flex w-full flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setJoinSession("create")}
                className="flex w-full flex-row items-center justify-between space-x-4 rounded-md border-2 border-dashed border-white bg-white bg-opacity-5 px-2 py-2 hover:bg-opacity-10 active:scale-95 active:bg-opacity-30"
              >
                <p className="min-w-32 py-[2px] text-2xl font-bold">
                  {"Créer"}
                </p>
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
            </div>
            <div className="flex w-full flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => setJoinSession("join")}
                className="flex flex-row items-center justify-center space-x-4 rounded-md border-2 border-dashed border-white bg-white bg-opacity-5 px-2 py-2 hover:bg-opacity-10 active:scale-95 active:bg-opacity-30"
              >
                <p className="min-w-32 py-[2px] text-2xl font-bold">
                  {"Rejoindre"}
                </p>
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
