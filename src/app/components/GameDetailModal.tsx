"use client";

import { useState } from "react";
import type { Game } from "@/lib/types";

export function GameDetailModal({
  game,
  currentUserId,
  onClose,
  onCompleteRequested,
  onChanged,
}: {
  game: Game;
  currentUserId: string;
  onClose: () => void;
  onCompleteRequested: () => void;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyRequestedComplete = game.approvals.some(
    (a) => a.type === "complete" && a.userId === currentUserId
  );

  const pendingType =
    game.status === "pending_add"
      ? "add"
      : game.status === "pending_complete"
        ? "complete"
        : null;
  const alreadyDecidedPending =
    pendingType !== null &&
    game.approvals.some(
      (a) => a.type === pendingType && a.userId === currentUserId
    );

  async function markComplete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${game.id}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehlgeschlagen");
        return;
      }
      onCompleteRequested();
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${game.id}/reopen`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehlgeschlagen");
        return;
      }
      onCompleteRequested();
    } finally {
      setBusy(false);
    }
  }

  async function decidePending(decision: "approved" | "rejected") {
    if (!pendingType) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${game.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: pendingType, decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehlgeschlagen");
        return;
      }
      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {game.trailerUrl ? (
          <video
            src={game.trailerUrl}
            poster={game.headerImage ?? undefined}
            controls
            className="aspect-video w-full bg-black"
          />
        ) : game.headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.headerImage}
            alt={game.title}
            className="aspect-video w-full object-cover"
          />
        ) : null}

        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold">{game.title}</h2>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-sm text-neutral-400 hover:text-neutral-100"
            >
              Schließen
            </button>
          </div>

          {pendingType && (
            <div className="rounded-md bg-amber-950/40 border border-amber-800/50 px-3 py-2 text-sm text-amber-300">
              {pendingType === "add"
                ? `${game.requestedBy} möchte dieses Spiel zur Liste hinzufügen.`
                : "Jemand hat vorgeschlagen, dieses Spiel als durchgespielt zu markieren."}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...game.genres, ...game.categories])).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300"
              >
                {tag}
              </span>
            ))}
          </div>

          {game.shortDescription && (
            <p className="text-sm text-neutral-300">{game.shortDescription}</p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-400">
            {game.releaseDate && <span>Release: {game.releaseDate}</span>}
            {game.price && <span>Preis: {game.price}</span>}
            <span>Vorgeschlagen von: {game.requestedBy}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {game.steamUrl && (
              <a
                href={game.steamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700"
              >
                Auf Steam ansehen
              </a>
            )}

            {pendingType && !alreadyDecidedPending && (
              <>
                <button
                  onClick={() => decidePending("approved")}
                  disabled={busy}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                >
                  Zustimmen
                </button>
                <button
                  onClick={() => decidePending("rejected")}
                  disabled={busy}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
                >
                  Ablehnen
                </button>
              </>
            )}

            {pendingType && alreadyDecidedPending && (
              <span className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300">
                Du hast bereits zugestimmt, warte auf die zweite Person
              </span>
            )}

            {game.status === "active" && (
              <button
                onClick={markComplete}
                disabled={busy || alreadyRequestedComplete}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-500 disabled:opacity-50"
              >
                {alreadyRequestedComplete
                  ? "Warte auf Zustimmung…"
                  : "Als durchgespielt markieren"}
              </button>
            )}

            {game.status === "completed" && game.completedAt && (
              <>
                <span className="rounded-md bg-green-900/50 px-4 py-2 text-sm text-green-300">
                  Durchgespielt am {game.completedAt}
                </span>
                <button
                  onClick={reopen}
                  disabled={busy}
                  className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
                >
                  Zurück auf die Liste setzen
                </button>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
