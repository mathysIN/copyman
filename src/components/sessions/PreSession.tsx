"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { SessionType } from "~/server/db/redis";

export function PreSession() {
  const formRef = useRef<HTMLFormElement>(null);
  const [sessionValue, setSessionValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMessage("");
    e.preventDefault();
    if (!sessionValue) {
      setErrorMessage("Session inexistante");
      return;
    }

    document.cookie = `session=${sessionValue}; expires=${new Date(
      Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
    )}; path=/;`;

    if (passwordValue) {
      document.cookie = `password=${passwordValue}; expires=${new Date(
        Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
      )}; path=/;`;
    }
    const result:
      | (SessionType & {
          hasPassword: boolean;
          isValidPassword: boolean;
          createNewSession: boolean;
        })
      | undefined = await fetch(`/api/sessions?sessionId=${sessionValue}`, {})
      .then((res) => res.json())
      .catch(() => {});
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
          className="outline-none"
          placeholder="session"
        />
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
            className="outline-none"
            placeholder="password"
          />
        </span>
      )}
      <button type="submit" className="hidden" />
      <div className="h-8" />
      <Link href="/">
        <Image src="/logo.png" width={150} height={150} alt="logo" />
      </Link>
    </form>
  );
}
