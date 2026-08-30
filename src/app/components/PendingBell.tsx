"use client";

import { useState } from "react";
import type { Game } from "@/lib/types";
import { CheckIcon, XIcon } from "./icons";

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
    type: "add" | "complete" | "remove",
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
        className="relative rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5 text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100"
        aria-label="Offene Anfragen"
      >
        <BellIcon />
        {pending.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white ring-2 ring-neutral-950">
            {pending.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/50">
          <div className="border-b border-neutral-800 px-3.5 py-3 text-sm font-semibold">
            Offene Anfragen
          </div>
          <div className="max-h-96 overflow-y-auto">
            {pending.length === 0 && (
              <p className="p-4 text-sm text-neutral-400">
                Keine offenen Anfragen
              </p>
            )}
            {pending.map((game) => {
              const type =
                game.status === "pending_add"
                  ? "add"
                  : game.status === "pending_remove"
                    ? "remove"
                    : "complete";
              return (
                <div
                  key={game.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setOpen(false);
                    onSelectGame(game);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setOpen(false);
                      onSelectGame(game);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-neutral-800/80 p-3 text-left transition last:border-b-0 hover:bg-neutral-800/50"
                >
                  <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-800">
                    {game.headerImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={game.headerImage}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {game.title}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      {type === "add" &&
                        `${game.requestedBy} möchte hinzufügen`}
                      {type === "complete" && "als durchgespielt markieren"}
                      {type === "remove" && "von der Liste entfernen"}
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => decide(game, type, "approved")}
                      disabled={busyId === game.id}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      aria-label="Zustimmen"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => decide(game, type, "rejected")}
                      disabled={busyId === game.id}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-500 disabled:opacity-50"
                      aria-label="Ablehnen"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
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
