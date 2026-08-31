"use client";

import { useEffect, useState } from "react";
import type { Game } from "@/lib/types";
import { CheckIcon, ChevronDownIcon, XIcon } from "./icons";

const MAIN_TAG_COUNT = 3;

function reviewTone(percent: number | null): "positive" | "mixed" | "negative" {
  if (percent === null) return "mixed";
  if (percent >= 70) return "positive";
  if (percent >= 40) return "mixed";
  return "negative";
}

const reviewToneClasses: Record<string, string> = {
  positive: "bg-emerald-950/50 text-emerald-300 border-emerald-800/60",
  mixed: "bg-amber-950/50 text-amber-300 border-amber-800/60",
  negative: "bg-rose-950/50 text-rose-300 border-rose-800/60",
};

export function GameDetailModal({
  game: initialGame,
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
  const [game, setGame] = useState(initialGame);
  useEffect(() => setGame(initialGame), [initialGame]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const alreadyRequestedComplete = game.approvals.some(
    (a) => a.type === "complete" && a.userId === currentUserId
  );
  const alreadyRequestedRemove = game.approvals.some(
    (a) => a.type === "remove" && a.userId === currentUserId
  );

  const pendingType =
    game.status === "pending_add"
      ? "add"
      : game.status === "pending_complete"
        ? "complete"
        : game.status === "pending_remove"
          ? "remove"
          : null;
  const alreadyDecidedPending =
    pendingType !== null &&
    game.approvals.some(
      (a) => a.type === pendingType && a.userId === currentUserId
    );

  const allTags = Array.from(new Set([...game.genres, ...game.categories]));
  const mainTags = allTags.slice(0, MAIN_TAG_COUNT);
  const restTags = allTags.slice(MAIN_TAG_COUNT);

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

  async function requestRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${game.id}/remove`, {
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

  async function togglePlaying() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${game.id}/playing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playing: !game.isPlaying }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehlgeschlagen");
        return;
      }
      const data = await res.json();
      if (data.game) setGame(data.game);
      onChanged?.();
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

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${game.id}/withdraw`, {
        method: "POST",
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {game.trailerUrl ? (
            <video
              src={game.trailerUrl}
              poster={game.headerImage ?? undefined}
              controls
              className="aspect-video w-full bg-black object-contain"
            />
          ) : game.headerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.headerImage}
              alt={game.title}
              className="aspect-[460/215] w-full bg-black object-contain"
            />
          ) : null}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
            aria-label="Schließen"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-xl font-semibold">{game.title}</h2>
            {game.reviewPositivePercent !== null && (
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${reviewToneClasses[reviewTone(game.reviewPositivePercent)]}`}
              >
                {game.reviewScoreDesc ?? `${game.reviewPositivePercent}% positiv`}
                {game.reviewTotal ? ` · ${game.reviewTotal.toLocaleString("de-DE")} Bewertungen` : ""}
              </span>
            )}
          </div>

          {pendingType && (
            <div
              className={`rounded-lg border px-3.5 py-2.5 text-sm ${
                pendingType === "remove"
                  ? "border-rose-800/50 bg-rose-950/40 text-rose-300"
                  : "border-amber-800/50 bg-amber-950/40 text-amber-300"
              }`}
            >
              {pendingType === "add" &&
                `${game.requestedBy} möchte dieses Spiel zur Liste hinzufügen.`}
              {pendingType === "complete" &&
                "Jemand hat vorgeschlagen, dieses Spiel als durchgespielt zu markieren."}
              {pendingType === "remove" &&
                "Jemand möchte dieses Spiel von der Liste entfernen."}
            </div>
          )}

          {game.shortDescription && (
            <p className="text-sm leading-relaxed text-neutral-300">
              {game.shortDescription}
            </p>
          )}

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {(tagsExpanded ? allTags : mainTags).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-800/80 px-2.5 py-1 text-xs text-neutral-300"
                >
                  {tag}
                </span>
              ))}
              {restTags.length > 0 && (
                <button
                  onClick={() => setTagsExpanded((v) => !v)}
                  className="flex items-center gap-1 rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
                >
                  {tagsExpanded ? "Weniger" : `Tags +${restTags.length}`}
                  <ChevronDownIcon
                    className={`h-3 w-3 transition-transform ${tagsExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-neutral-400">
            {game.releaseDate && <span>Release: {game.releaseDate}</span>}
            {game.price && (
              <span className="flex items-center gap-2">
                {game.discountPercent > 0 && game.originalPrice ? (
                  <>
                    <span className="rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
                      -{game.discountPercent}%
                    </span>
                    <span className="text-neutral-500 line-through">
                      {game.originalPrice}
                    </span>
                    <span className="font-medium text-emerald-400">
                      {game.price}
                    </span>
                  </>
                ) : (
                  <span>Preis: {game.price}</span>
                )}
              </span>
            )}
            <span>Vorgeschlagen von: {game.requestedBy}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {game.steamUrl && (
              <a
                href={game.steamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium transition hover:bg-neutral-700"
              >
                Auf Steam ansehen
              </a>
            )}

            {pendingType && !alreadyDecidedPending && (
              <>
                <button
                  onClick={() => decidePending("approved")}
                  disabled={busy}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
                    pendingType === "remove"
                      ? "bg-rose-600 hover:bg-rose-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  Zustimmen
                </button>
                <button
                  onClick={() => decidePending("rejected")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium transition hover:bg-rose-600 disabled:opacity-50"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  Ablehnen
                </button>
              </>
            )}

            {pendingType && alreadyDecidedPending && (
              <>
                <span className="rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-300">
                  Du hast bereits zugestimmt, warte auf die zweite Person
                </span>
                <button
                  onClick={withdraw}
                  disabled={busy}
                  className="rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800 disabled:opacity-50"
                >
                  Anfrage zurückziehen
                </button>
              </>
            )}

            {game.status === "active" && (
              <button
                onClick={togglePlaying}
                disabled={busy}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  game.isPlaying
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "border border-sky-800/60 text-sky-400 hover:bg-sky-950/40"
                }`}
              >
                🎮 {game.isPlaying ? "Wird gerade gespielt" : "Gerade am Spielen"}
              </button>
            )}

            {game.status === "active" && (
              <button
                onClick={markComplete}
                disabled={busy || alreadyRequestedComplete}
                className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {alreadyRequestedComplete ? (
                  "Warte auf Zustimmung…"
                ) : (
                  <>
                    <CheckIcon className="h-3.5 w-3.5" />
                    Als durchgespielt markieren
                  </>
                )}
              </button>
            )}

            {game.status === "completed" && game.completedAt && (
              <>
                <span className="rounded-full bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
                  Durchgespielt am {game.completedAt}
                </span>
                <button
                  onClick={reopen}
                  disabled={busy}
                  className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium transition hover:bg-neutral-700 disabled:opacity-50"
                >
                  Zurück auf die Liste setzen
                </button>
              </>
            )}

            {(game.status === "active" || game.status === "completed") && (
              <button
                onClick={requestRemove}
                disabled={busy || alreadyRequestedRemove}
                className="flex items-center gap-1.5 rounded-full border border-rose-900/60 bg-transparent px-4 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-950/40 disabled:opacity-50"
              >
                {alreadyRequestedRemove
                  ? "Entfernen wartet auf Zustimmung…"
                  : "Von der Liste entfernen"}
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
