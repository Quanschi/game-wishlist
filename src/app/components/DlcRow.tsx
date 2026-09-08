"use client";

export type DlcRowData = {
  appid: number;
  title: string;
  headerImage: string | null;
  steamUrl: string | null;
  price: string | null;
  originalPrice: string | null;
  discountPercent: number;
};

export function DlcRow({ dlc }: { dlc: DlcRowData }) {
  return (
    <a
      href={dlc.steamUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg bg-neutral-800/60 p-2 transition hover:bg-neutral-800"
    >
      <div className="flex h-10 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-900">
        {dlc.headerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dlc.headerImage}
            alt=""
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
        {dlc.title}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs">
        {dlc.discountPercent > 0 && dlc.originalPrice ? (
          <>
            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              -{dlc.discountPercent}%
            </span>
            <span className="text-neutral-500 line-through">
              {dlc.originalPrice}
            </span>
            <span className="font-medium text-emerald-400">{dlc.price}</span>
          </>
        ) : (
          <span className="text-neutral-400">{dlc.price ?? "–"}</span>
        )}
      </span>
    </a>
  );
}
