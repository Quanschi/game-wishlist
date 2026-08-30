"use client";

import { useEffect, useRef, useState } from "react";

type SearchResult = {
  appid: number;
  name: string;
  tinyImage: string | null;
};

export function AddGameModal({
  onClose,
  onRequested,
}: {
  onClose: () => void;
  onRequested: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/steam/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function requestGame(appid: number) {
    setRequestingId(appid);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehlgeschlagen");
        return;
      }
      onRequested();
      onClose();
    } finally {
      setRequestingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="max-h-[75vh] w-full max-w-lg overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-800 p-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Spieltitel oder Steam-Link eingeben…"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 outline-none focus:border-neutral-500"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {loading && (
            <p className="p-3 text-sm text-neutral-400">Suche läuft…</p>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="p-3 text-sm text-neutral-400">Keine Treffer</p>
          )}
          {error && <p className="p-3 text-sm text-red-400">{error}</p>}
          {results.map((r) => (
            <button
              key={r.appid}
              onClick={() => requestGame(r.appid)}
              disabled={requestingId !== null}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-neutral-800 disabled:opacity-50"
            >
              {r.tinyImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.tinyImage}
                  alt=""
                  className="h-10 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-10 w-20 shrink-0 rounded bg-neutral-800" />
              )}
              <span className="flex-1 truncate">{r.name}</span>
              <span className="shrink-0 text-xs text-neutral-400">
                {requestingId === r.appid
                  ? "Wird vorgeschlagen…"
                  : "Vorschlagen"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
