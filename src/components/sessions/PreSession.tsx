"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import type { SessionType } from "~/server/db/redis";
import { useSearchParams } from "next/navigation";

export function PreSession() {
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const [sessionValue, setSessionValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    searchParams.get("msg") ?? "",
  );
  const [loading, setLoading] = useState(false);

  const sumbitForm = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
      `/api/sessions?sessionId=${sessionValue}&password=${passwordValue}`,
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
      if (result.hasPassword) {
        setNeedPassword(true);
      }

      if (result.hasPassword && !result.isValidPassword) {
        setErrorMessage("Mot de passe incorrect");
        return;
      }
    }
    formRef.current?.submit();
  };
  return (
    <form
      method="post"
      action="/api/sessions"
      className="flex flex-col items-center justify-center gap-4"
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <label className="text-xl">Créer/Rejoindre une session</label>
      {errorMessage && <span className="text-red-500">{errorMessage}</span>}
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
      {needPassword && (
        <span className="flex flex-row space-x-[1px] rounded-xl border-blue-600 bg-white p-2 text-black">
          <span className="w-6 px-1">🔒</span>
          <div className="h-1" />
          <input
            name="password"
            type="password"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            onKeyDown={sumbitForm}
            className="outline-none"
            placeholder="password"
          />
        </span>
      )}
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
      <div className="h-2" />
      <button type="submit" className="w-full flex flex-col justify-center">
        <div className="flex border-2 border-white border-dashed rounded-md bg-white bg-opacity-5 hover:bg-opacity-10 active:scale-95 px-2 py-2 flex-row space-x-4 items-center justify-center">
          <p className="font-bold text-2xl py-[2px]">Rejoindre</p>
          <Image src="/logo.png" width={50} height={50} alt="logo" />
        </div>
      </button>
    </form>
  );
}
