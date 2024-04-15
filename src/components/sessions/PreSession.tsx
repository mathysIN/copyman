"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function PreSession() {
  const [sessionValue, setSessionValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  return (
    <form
      method="post"
      action="/api/sessions"
      className="flex flex-col items-center justify-center gap-4"
    >
      <label className="text-xl">Créer/Rejoindre une session</label>
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
      <span className="flex flex-row space-x-[1px] rounded-xl border-blue-600 bg-white p-2 text-black">
        <span className="w-6 px-1"></span>
        <div className="h-1" />
        <input
          name="password"
          type="password"
          value={passwordValue}
          onChange={(e) => setPasswordValue(e.target.value)}
          className="outline-none"
          placeholder="mot de passe"
        />
      </span>
      <button type="submit" />
      <div className="h-8" />

      <Link href="/">
        <Image src="/logo.png" width={150} height={150} alt="logo" />
      </Link>
    </form>
  );
}
