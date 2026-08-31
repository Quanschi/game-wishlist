"use client";

import type { Game } from "@/lib/types";
import { StarIcon } from "./icons";

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
      className={`group relative overflow-hidden rounded-xl border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 ${
        highlight
          ? "border-amber-400 ring-2 ring-amber-400/50"
          : "border-neutral-800 hover:border-neutral-700"
      } bg-neutral-900`}
    >
      <div className="relative aspect-[460/215] w-full overflow-hidden bg-neutral-800">
        {game.headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.headerImage}
            alt={game.title}
            className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
        {game.reviewPositivePercent !== null && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-neutral-200 backdrop-blur-sm">
            <StarIcon className="h-2.5 w-2.5 text-amber-400" />
            {game.reviewPositivePercent}%
          </span>
        )}
        {game.discountPercent > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            -{game.discountPercent}%
          </span>
        )}
        {game.isPlaying && game.status === "active" && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-sky-600/90 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            🎮 Spielt gerade
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate font-medium">{game.title}</p>
        {game.genres.length > 0 && (
          <p className="mt-1 truncate text-xs text-neutral-500">
            {game.genres.slice(0, 3).join(" · ")}
          </p>
        )}
      </div>
      {game.status === "completed" && (
        <span className="absolute right-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-xs font-medium">
          Durchgespielt
        </span>
      )}
      {game.status === "pending_add" && (
        <span className="absolute right-2 top-2 rounded-full bg-amber-600/90 px-2 py-0.5 text-xs font-medium">
          Wartet auf Zustimmung
        </span>
      )}
      {game.status === "pending_complete" && (
        <span className="absolute right-2 top-2 rounded-full bg-amber-600/90 px-2 py-0.5 text-xs font-medium">
          Durchspielen wartet
        </span>
      )}
      {game.status === "pending_remove" && (
        <span className="absolute right-2 top-2 rounded-full bg-rose-600/90 px-2 py-0.5 text-xs font-medium">
          Entfernen wartet
        </span>
      )}
      {highlight && (
        <span className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-neutral-900">
          🎲 Ausgewählt
        </span>
      )}
    </button>
  );
}
