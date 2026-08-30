"use client";

import { useState } from "react";
import type { Game } from "@/lib/types";

export function PendingBell({
  pending,
  onDecided,
  onSelectGame,
}: {
  pending: Game[];
  onDecided: () => void;
  onSelectGame: (game: Game) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function decide(
    game: Game,
    type: "add" | "complete",
    decision: "approved" | "rejected"
  ) {
    setBusyId(game.id);
    try {
      await fetch(`/api/games/${game.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, decision }),
      });
      onDecided();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-neutral-700 p-2 hover:bg-neutral-800"
        aria-label="Offene Anfragen"
      >
        <BellIcon />
        {pending.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
            {pending.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-80 rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl">
          <div className="border-b border-neutral-800 p-3 text-sm font-medium">
            Offene Anfragen
          </div>
          <div className="max-h-96 overflow-y-auto">
            {pending.length === 0 && (
              <p className="p-3 text-sm text-neutral-400">
                Keine offenen Anfragen
              </p>
            )}
            {pending.map((game) => {
              const type = game.status === "pending_add" ? "add" : "complete";
              return (
                <button
                  key={game.id}
                  onClick={() => {
                    setOpen(false);
                    onSelectGame(game);
                  }}
                  className="flex w-full items-center gap-3 border-b border-neutral-800 p-3 text-left last:border-b-0 hover:bg-neutral-800/60"
                >
                  {game.headerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.headerImage}
                      alt=""
                      className="h-10 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-16 shrink-0 rounded bg-neutral-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {game.title}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      {type === "add"
                        ? `${game.requestedBy} möchte hinzufügen`
                        : "als durchgespielt markieren"}
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => decide(game, type, "approved")}
                      disabled={busyId === game.id}
                      className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium hover:bg-green-500 disabled:opacity-50"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => decide(game, type, "rejected")}
                      disabled={busyId === game.id}
                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium hover:bg-red-500 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
