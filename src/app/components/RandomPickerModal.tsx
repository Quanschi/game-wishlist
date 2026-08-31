"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { Game } from "@/lib/types";
import { DiceIcon, StarIcon, XIcon } from "./icons";

const ROLL_DURATION_MS = 3000;
const CYCLE_INTERVAL_MS = 90;

function fireSideConfetti() {
  const end = Date.now() + 500;
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      startVelocity: 45,
      origin: { x: 0, y: 1 },
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      startVelocity: 45,
      origin: { x: 1, y: 1 },
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function RandomPickerModal({
  titles,
  tag,
  onClose,
  onRevealed,
  onOpenDetails,
  onChanged,
}: {
  titles: string[];
  tag?: string;
  onClose: () => void;
  onRevealed: (game: Game) => void;
  onOpenDetails: (game: Game) => void;
  onChanged: () => void;
}) {
  const [phase, setPhase] = useState<"rolling" | "revealed" | "error">(
    "rolling"
  );
  const [cycleIndex, setCycleIndex] = useState(0);
  const [revealedGame, setRevealedGame] = useState<Game | null>(null);
  const [rollKey, setRollKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const cyclingTitles = titles.length > 0 ? titles : ["…"];

  useEffect(() => {
    let cancelled = false;
    setPhase("rolling");
    setRevealedGame(null);

    const cycleTimer = setInterval(() => {
      setCycleIndex((i) => i + 1);
    }, CYCLE_INTERVAL_MS);

    const fetchPromise = fetch(
      `/api/games/random${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .catch(() => null);
    const delayPromise = new Promise((resolve) =>
      setTimeout(resolve, ROLL_DURATION_MS)
    );

    Promise.all([fetchPromise, delayPromise]).then(([data]) => {
      if (cancelled) return;
      clearInterval(cycleTimer);
      if (!data?.game) {
        setPhase("error");
        return;
      }
      setRevealedGame(data.game);
      setPhase("revealed");
      onRevealed(data.game);
      fireSideConfetti();
    });

    return () => {
      cancelled = true;
      clearInterval(cycleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey, tag]);

  async function togglePlaying() {
    if (!revealedGame) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/${revealedGame.id}/playing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playing: !revealedGame.isPlaying }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.game) setRevealedGame(data.game);
        onChanged();
      }
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
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-300">
            🎲 Zufälliges Spiel
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Schließen"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {phase === "rolling" && (
          <div className="flex h-64 flex-col items-center justify-center gap-4 px-6">
            <div className="h-8 overflow-hidden">
              <p
                key={cycleIndex}
                className="animate-slot-cycle max-w-[220px] truncate text-center text-lg font-semibold text-neutral-100"
              >
                {cyclingTitles[cycleIndex % cyclingTitles.length]}
              </p>
            </div>
            <p className="text-xs text-neutral-500">Würfeln läuft…</p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-neutral-300">
              Keine aktiven Spiele auf der Liste{tag ? " mit diesem Tag" : ""}.
            </p>
            <button
              onClick={onClose}
              className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium transition hover:bg-neutral-700"
            >
              Schließen
            </button>
          </div>
        )}

        {phase === "revealed" && revealedGame && (
          <div>
            <div className="relative aspect-[460/215] w-full overflow-hidden bg-neutral-800">
              {revealedGame.headerImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={revealedGame.headerImage}
                  alt={revealedGame.title}
                  className="h-full w-full object-contain"
                />
              ) : null}
              {revealedGame.discountPercent > 0 && (
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  -{revealedGame.discountPercent}%
                </span>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{revealedGame.title}</h3>
                {revealedGame.reviewPositivePercent !== null && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-950/50 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    <StarIcon className="h-3 w-3 text-amber-400" />
                    {revealedGame.reviewPositivePercent}%
                  </span>
                )}
              </div>
              {revealedGame.price && (
                <div className="flex items-center gap-2 text-sm">
                  {revealedGame.discountPercent > 0 && revealedGame.originalPrice ? (
                    <>
                      <span className="text-neutral-500 line-through">
                        {revealedGame.originalPrice}
                      </span>
                      <span className="font-medium text-emerald-400">
                        {revealedGame.price}
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400">{revealedGame.price}</span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={togglePlaying}
                  disabled={busy}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${
                    revealedGame.isPlaying
                      ? "bg-sky-600 text-white hover:bg-sky-500"
                      : "border border-sky-800/60 text-sky-400 hover:bg-sky-950/40"
                  }`}
                >
                  🎮 {revealedGame.isPlaying ? "Wird gespielt" : "Jetzt spielen"}
                </button>
                <button
                  onClick={() => setRollKey((k) => k + 1)}
                  className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
                >
                  <DiceIcon className="h-4 w-4" />
                  Reroll
                </button>
                <button
                  onClick={() => onOpenDetails(revealedGame)}
                  className="rounded-full bg-neutral-800 px-3.5 py-2 text-sm font-medium transition hover:bg-neutral-700"
                >
                  Details ansehen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
