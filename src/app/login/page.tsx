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
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6"
      >
        <h1 className="text-xl font-semibold">Spiele-Wunschliste</h1>
        <div className="space-y-1">
          <label className="text-sm text-neutral-400">Benutzername</label>
          <input
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 outline-none focus:border-neutral-500"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-neutral-400">Passwort</label>
          <input
            type="password"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 outline-none focus:border-neutral-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-3 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
