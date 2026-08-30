"use client";

import type { Game } from "@/lib/types";

export function GameTile({
  game,
  onClick,
  highlight,
}: {
  game: Game;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg border text-left transition ${
        highlight
          ? "border-amber-400 ring-2 ring-amber-400/50"
          : "border-neutral-800 hover:border-neutral-600"
      } bg-neutral-900`}
    >
      <div className="aspect-video w-full overflow-hidden bg-neutral-800">
        {game.headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.headerImage}
            alt={game.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="p-3">
        <p className="truncate font-medium">{game.title}</p>
        {game.genres.length > 0 && (
          <p className="mt-1 truncate text-xs text-neutral-400">
            {game.genres.slice(0, 3).join(" · ")}
          </p>
        )}
      </div>
      {game.status === "completed" && (
        <span className="absolute right-2 top-2 rounded bg-green-600/90 px-2 py-0.5 text-xs font-medium">
          Durchgespielt
        </span>
      )}
      {game.status === "pending_add" && (
        <span className="absolute right-2 top-2 rounded bg-amber-600/90 px-2 py-0.5 text-xs font-medium">
          Wartet auf Zustimmung
        </span>
      )}
      {game.status === "pending_complete" && (
        <span className="absolute right-2 top-2 rounded bg-amber-600/90 px-2 py-0.5 text-xs font-medium">
          Durchspielen wartet
        </span>
      )}
      {highlight && (
        <span className="absolute right-2 top-2 rounded bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-neutral-900">
          🎲 Ausgewählt
        </span>
      )}
    </button>
  );
}
