"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login fehlgeschlagen");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.12),transparent_60%)] p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-7 shadow-2xl shadow-black/50 backdrop-blur-sm"
      >
        <h1 className="text-xl font-semibold tracking-tight">Spiele-Wunschliste</h1>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-400">Benutzername</label>
          <input
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800/80 px-3.5 py-2.5 outline-none transition focus:border-indigo-500"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-neutral-400">Passwort</label>
          <input
            type="password"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800/80 px-3.5 py-2.5 outline-none transition focus:border-indigo-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
