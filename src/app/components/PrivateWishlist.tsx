"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrivateWishlistItem } from "@/lib/privateWishlist";
import { ChevronDownIcon, StarIcon, XIcon } from "./icons";
import { DlcRow } from "./DlcRow";

const MAIN_TAG_COUNT = 3;
const DLC_PREVIEW_COUNT = 5;

function PrivateWishlistTile({
  item,
  onClick,
}: {
  item: PrivateWishlistItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-700 hover:shadow-lg hover:shadow-black/30"
    >
      <div className="relative aspect-[460/215] w-full overflow-hidden bg-neutral-800">
        {item.headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.headerImage}
            alt={item.title}
            className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
          />
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
        {item.reviewPositivePercent !== null && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-neutral-200 backdrop-blur-sm">
            <StarIcon className="h-2.5 w-2.5 text-amber-400" />
            {item.reviewPositivePercent}%
          </span>
        )}
        {item.discountPercent > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            -{item.discountPercent}%
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate font-medium">{item.title}</p>
        {item.genres.length > 0 && (
          <p className="mt-1 truncate text-xs text-neutral-500">
            {item.genres.slice(0, 3).join(" · ")}
          </p>
        )}
      </div>
    </button>
  );
}

function PrivateWishlistDetailModal({
  item,
  onClose,
}: {
  item: PrivateWishlistItem;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "proposed" | "duplicate">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [dlcsExpanded, setDlcsExpanded] = useState(false);
  const allTags = Array.from(new Set([...item.genres, ...item.categories]));
  const mainTags = allTags.slice(0, MAIN_TAG_COUNT);
  const restTags = allTags.slice(MAIN_TAG_COUNT);

  async function propose() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appid: item.appid }),
      });
      if (res.status === 409) {
        setStatus("duplicate");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehlgeschlagen");
        return;
      }
      setStatus("proposed");
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
          {item.headerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.headerImage}
              alt={item.title}
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
            <h2 className="text-xl font-semibold">{item.title}</h2>
            {item.reviewPositivePercent !== null && (
              <span className="rounded-full border border-emerald-800/60 bg-emerald-950/50 px-2.5 py-1 text-xs font-medium text-emerald-300">
                {item.reviewScoreDesc ?? `${item.reviewPositivePercent}% positiv`}
                {item.reviewTotal
                  ? ` · ${item.reviewTotal.toLocaleString("de-DE")} Bewertungen`
                  : ""}
              </span>
            )}
          </div>

          {item.shortDescription && (
            <p className="text-sm leading-relaxed text-neutral-300">
              {item.shortDescription}
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
            {item.releaseDate && <span>Release: {item.releaseDate}</span>}
            {item.price && (
              <span className="flex items-center gap-2">
                {item.discountPercent > 0 && item.originalPrice ? (
                  <>
                    <span className="rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
                      -{item.discountPercent}%
                    </span>
                    <span className="text-neutral-500 line-through">
                      {item.originalPrice}
                    </span>
                    <span className="font-medium text-emerald-400">
                      {item.price}
                    </span>
                  </>
                ) : (
                  <span>Preis: {item.price}</span>
                )}
              </span>
            )}
          </div>

          {item.dlcs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-300">
                DLCs ({item.dlcs.length})
              </p>
              <div className="space-y-1.5">
                {item.dlcs.slice(0, DLC_PREVIEW_COUNT).map((dlc) => (
                  <DlcRow key={dlc.appid} dlc={dlc} />
                ))}
              </div>
              {item.dlcs.length > DLC_PREVIEW_COUNT && (
                <>
                  {dlcsExpanded && (
                    <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {item.dlcs.slice(DLC_PREVIEW_COUNT).map((dlc) => (
                        <DlcRow key={dlc.appid} dlc={dlc} />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setDlcsExpanded((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
                  >
                    {dlcsExpanded
                      ? "Weniger anzeigen"
                      : `Mehr anzeigen (+${item.dlcs.length - DLC_PREVIEW_COUNT})`}
                    <ChevronDownIcon
                      className={`h-3 w-3 transition-transform ${dlcsExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {item.steamUrl && (
              <a
                href={item.steamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium transition hover:bg-neutral-700"
              >
                Auf Steam ansehen
              </a>
            )}

            {item.ggDealsUrl && (
              <a
                href={item.ggDealsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium transition hover:bg-neutral-700"
              >
                Auf gg.deals ansehen
              </a>
            )}

            {status === "idle" && (
              <button
                onClick={propose}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                Zur Koop-Liste vorschlagen
              </button>
            )}
            {status === "proposed" && (
              <span className="rounded-full bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
                Vorgeschlagen — wartet auf Zustimmung
              </span>
            )}
            {status === "duplicate" && (
              <span className="rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-300">
                Ist schon auf der Koop-Liste
              </span>
            )}
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function PrivateWishlistView() {
  const [loading, setLoading] = useState(true);
  const [needsSteamId, setNeedsSteamId] = useState(false);
  const [items, setItems] = useState<PrivateWishlistItem[]>([]);
  const [steamIdInput, setSteamIdInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrivateWishlistItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/private-wishlist");
      const data = await res.json();
      setNeedsSteamId(Boolean(data.needsSteamId));
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSteamId(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/private-wishlist/steam-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamId64: steamIdInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error ?? "Fehlgeschlagen");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-neutral-400">Lade…</p>;
  }

  if (needsSteamId) {
    return (
      <form
        onSubmit={saveSteamId}
        className="max-w-md space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6"
      >
        <h2 className="text-lg font-semibold">Deine Steam-Wishlist verbinden</h2>
        <p className="text-sm text-neutral-400">
          Trag deine SteamID64 ein (17-stellige Zahl, z.B. über{" "}
          <a
            href="https://steamid.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 underline"
          >
            steamid.io
          </a>{" "}
          herausfinden). Deine Wishlist muss dafür in den Steam-Datenschutzeinstellungen
          auf &quot;öffentlich&quot; stehen.
        </p>
        <input
          value={steamIdInput}
          onChange={(e) => setSteamIdInput(e.target.value)}
          placeholder="76561198000000000"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-800/80 px-3.5 py-2.5 outline-none transition focus:border-indigo-500"
        />
        {formError && <p className="text-sm text-rose-400">{formError}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </form>
    );
  }

  return (
    <>
      {items.length === 0 ? (
        <p className="text-neutral-400">
          Deine Steam-Wishlist ist leer (oder noch nicht öffentlich einsehbar).
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <PrivateWishlistTile
              key={item.appid}
              item={item}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      )}

      {selected && (
        <PrivateWishlistDetailModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
