"use client";

import { useState } from "react";

export function PreSession() {
  const [value, setValue] = useState("");
  return (
    <form
      method="post"
      action="/api/sessions"
      className="flex flex-col items-center justify-center gap-2"
    >
      <label className="text-xl">Create/Join session</label>
      <span className="flex flex-row space-x-[1px] rounded-xl border-blue-600 bg-white p-2 text-black">
        <span className="px-1">#</span>
        <div className="h-1" />
        <input
          name="session"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="outline-none"
          placeholder="token"
        />
      </span>
      <button type="submit" />
    </form>
  );
}
