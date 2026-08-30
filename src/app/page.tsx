"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/types";
import { GameTile } from "./components/GameTile";
import { GameDetailModal } from "./components/GameDetailModal";
import { AddGameModal } from "./components/AddGameModal";
import { PendingBell } from "./components/PendingBell";

type SortKey = "newest" | "title-asc" | "title-desc" | "release";
type Tab = "active" | "completed";

export default function HomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [pending, setPending] = useState<Game[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async (view: Tab) => {
    const res = await fetch(`/api/games?view=${view}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setGames(data.games ?? []);
  }, [router]);

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/games/pending");
    if (res.ok) {
      const data = await res.json();
      setPending(data.games ?? []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.userId) {
        router.push("/login");
        return;
      }
      setUserId(data.userId);
    })();
  }, [router]);

  useEffect(() => {
    setLoading(true);
    loadGames(tab).finally(() => setLoading(false));
  }, [tab, loadGames]);

  useEffect(() => {
    loadPending();
    const interval = setInterval(loadPending, 8000);
    return () => clearInterval(interval);
  }, [loadPending]);

  const refreshAll = useCallback(() => {
    loadGames(tab);
    loadPending();
  }, [loadGames, loadPending, tab]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const g of games) {
      for (const t of [...g.genres, ...g.categories]) set.add(t);
    }
    return Array.from(set).sort();
  }, [games]);

  const filteredGames = useMemo(() => {
    let result = games;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((g) => g.title.toLowerCase().includes(q));
    }
    if (tag) {
      result = result.filter(
        (g) => g.genres.includes(tag) || g.categories.includes(tag)
      );
    }
    const sorted = [...result];
    switch (sort) {
      case "title-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "release":
        sorted.sort((a, b) =>
          (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")
        );
        break;
      case "newest":
      default:
        sorted.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
        break;
    }
    return sorted;
  }, [games, search, tag, sort]);

  async function pickRandom() {
    const res = await fetch(`/api/games/random${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`);
    if (!res.ok) {
      alert("Keine aktiven Spiele auf der Liste");
      return;
    }
    const data = await res.json();
    setTab("active");
    setHighlightId(data.game.id);
    setSelectedGame(data.game);
  }

  if (!userId) return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <PendingBell pending={pending} onDecided={refreshAll} />
        <h1 className="mr-auto text-lg font-semibold sm:text-xl">
          Spiele-Wunschliste
        </h1>
        <span className="text-sm text-neutral-400">Angemeldet als {userId}</span>
        <button
          onClick={logout}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
        >
          Abmelden
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-neutral-700 p-0.5">
          <button
            onClick={() => setTab("active")}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === "active" ? "bg-neutral-700" : "hover:bg-neutral-800"
            }`}
          >
            Auf der Liste
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === "completed" ? "bg-neutral-700" : "hover:bg-neutral-800"
            }`}
          >
            Durchgespielt
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="In der Liste suchen…"
          className="min-w-40 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
        />

        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">Alle Tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none"
        >
          <option value="newest">Neueste zuerst</option>
          <option value="title-asc">Titel A–Z</option>
          <option value="title-desc">Titel Z–A</option>
          <option value="release">Release-Datum</option>
        </select>

        {tab === "active" && (
          <button
            onClick={pickRandom}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium hover:bg-purple-500"
          >
            🎲 Zufälliges Spiel
          </button>
        )}

        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500"
        >
          + Spiel vorschlagen
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-400">Lade…</p>
      ) : filteredGames.length === 0 ? (
        <p className="text-neutral-400">Keine Spiele gefunden.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filteredGames.map((game) => (
            <GameTile
              key={game.id}
              game={game}
              highlight={game.id === highlightId}
              onClick={() => setSelectedGame(game)}
            />
          ))}
        </div>
      )}

      {selectedGame && userId && (
        <GameDetailModal
          game={selectedGame}
          currentUserId={userId}
          onClose={() => setSelectedGame(null)}
          onCompleteRequested={() => {
            setSelectedGame(null);
            refreshAll();
          }}
        />
      )}

      {showAddModal && (
        <AddGameModal
          onClose={() => setShowAddModal(false)}
          onRequested={refreshAll}
        />
      )}
    </main>
  );
}
