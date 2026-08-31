"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/types";
import { GameTile } from "./components/GameTile";
import { GameDetailModal } from "./components/GameDetailModal";
import { AddGameModal } from "./components/AddGameModal";
import { PendingBell } from "./components/PendingBell";
import { NotificationSetup } from "./components/NotificationSetup";
import { RandomPickerModal } from "./components/RandomPickerModal";
import { SearchIcon } from "./components/icons";

type SortKey = "newest" | "title-asc" | "title-desc" | "release";
type Tab = "active" | "completed" | "mine";

export default function HomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [pending, setPending] = useState<Game[]>([]);
  const [myRequests, setMyRequests] = useState<Game[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRandomPicker, setShowRandomPicker] = useState(false);

  const loadGames = useCallback(async (view: Tab) => {
    if (view === "mine") return;
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

  const loadMyRequests = useCallback(async () => {
    const res = await fetch("/api/games/mine-pending");
    if (res.ok) {
      const data = await res.json();
      setMyRequests(data.games ?? []);
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
    loadMyRequests();
    const interval = setInterval(() => {
      loadPending();
      loadMyRequests();
    }, 8000);
    return () => clearInterval(interval);
  }, [loadPending, loadMyRequests]);

  const refreshAll = useCallback(() => {
    loadGames(tab);
    loadPending();
    loadMyRequests();
  }, [loadGames, loadPending, loadMyRequests, tab]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const displayGames = tab === "mine" ? myRequests : games;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const g of displayGames) {
      for (const t of [...g.genres, ...g.categories]) set.add(t);
    }
    return Array.from(set).sort();
  }, [displayGames]);

  const filteredGames = useMemo(() => {
    let result = displayGames;
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
  }, [displayGames, search, tag, sort]);

  if (!userId) return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <header className="relative z-20 mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 px-4 py-3 backdrop-blur-sm">
        <PendingBell
          pending={pending}
          onDecided={refreshAll}
          onSelectGame={setSelectedGame}
        />
        <h1 className="mr-auto text-lg font-semibold tracking-tight sm:text-xl">
          Spiele-Wunschliste
        </h1>
        <NotificationSetup />
        <span className="text-sm text-neutral-400">Angemeldet als {userId}</span>
        <button
          onClick={logout}
          className="rounded-full border border-neutral-700 px-3.5 py-1.5 text-sm transition hover:border-neutral-600 hover:bg-neutral-800"
        >
          Abmelden
        </button>
      </header>

      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-neutral-800 bg-neutral-900/60 p-1">
          <button
            onClick={() => setTab("active")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === "active"
                ? "bg-indigo-600 text-white"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            Auf der Liste
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === "completed"
                ? "bg-indigo-600 text-white"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            Durchgespielt
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === "mine"
                ? "bg-indigo-600 text-white"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            Warte auf Antwort
            {myRequests.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-neutral-900">
                {myRequests.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative min-w-40 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="In der Liste suchen…"
            className="w-full rounded-full border border-neutral-800 bg-neutral-900/60 py-1.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500"
          />
        </div>

        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3.5 py-1.5 text-sm outline-none transition focus:border-indigo-500"
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
          className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3.5 py-1.5 text-sm outline-none transition focus:border-indigo-500"
        >
          <option value="newest">Neueste zuerst</option>
          <option value="title-asc">Titel A–Z</option>
          <option value="title-desc">Titel Z–A</option>
          <option value="release">Release-Datum</option>
        </select>

        {tab === "active" && (
          <button
            onClick={() => setShowRandomPicker(true)}
            className="rounded-full bg-violet-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            🎲 Zufälliges Spiel
          </button>
        )}

        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          + Spiel vorschlagen
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-400">Lade…</p>
      ) : filteredGames.length === 0 ? (
        <p className="text-neutral-400">
          {tab === "mine"
            ? "Keine offenen Anfragen von dir — alles, was du vorgeschlagen oder abgehakt hast, ist schon entschieden."
            : "Keine Spiele gefunden."}
        </p>
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
          onChanged={refreshAll}
        />
      )}

      {showAddModal && (
        <AddGameModal
          onClose={() => setShowAddModal(false)}
          onRequested={refreshAll}
        />
      )}

      {showRandomPicker && (
        <RandomPickerModal
          titles={games.map((g) => g.title)}
          tag={tag || undefined}
          onClose={() => setShowRandomPicker(false)}
          onRevealed={(game) => setHighlightId(game.id)}
          onOpenDetails={(game) => {
            setShowRandomPicker(false);
            setSelectedGame(game);
          }}
          onChanged={refreshAll}
        />
      )}
    </main>
  );
}
