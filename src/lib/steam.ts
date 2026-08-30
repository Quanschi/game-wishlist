export type SteamSearchResult = {
  appid: number;
  name: string;
  tinyImage: string | null;
};

export type SteamGameDetails = {
  appid: number;
  title: string;
  headerImage: string | null;
  shortDescription: string;
  detailedDescription: string;
  trailerUrl: string | null;
  steamUrl: string;
  genres: string[];
  categories: string[];
  releaseDate: string | null;
  price: string | null;
  screenshots: string[];
};

const STORE_API = "https://store.steampowered.com/api";

function extractAppId(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/store\.steampowered\.com\/app\/(\d+)/i);
  if (match) return Number(match[1]);
  return null;
}

export async function searchSteamGames(
  query: string
): Promise<SteamSearchResult[]> {
  const appId = extractAppId(query);
  if (appId) {
    const details = await getSteamAppDetails(appId);
    if (!details) return [];
    return [
      {
        appid: details.appid,
        name: details.title,
        tinyImage: details.headerImage,
      },
    ];
  }

  const url = `${STORE_API}/storesearch/?term=${encodeURIComponent(
    query
  )}&l=german&cc=de`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{ id: number; name: string; tiny_image?: string }>;
  };
  return (data.items ?? []).map((item) => ({
    appid: item.id,
    name: item.name,
    tinyImage: item.tiny_image ?? null,
  }));
}

export async function getSteamAppDetails(
  appId: number
): Promise<SteamGameDetails | null> {
  const url = `${STORE_API}/appdetails?appids=${appId}&l=german&cc=de`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<
    string,
    {
      success: boolean;
      data?: {
        name: string;
        header_image?: string;
        short_description?: string;
        detailed_description?: string;
        genres?: Array<{ description: string }>;
        categories?: Array<{ description: string }>;
        release_date?: { date: string };
        price_overview?: { final_formatted: string };
        is_free?: boolean;
        movies?: Array<{
          mp4?: { max?: string; ["480"]?: string };
          webm?: { max?: string; ["480"]?: string };
        }>;
        screenshots?: Array<{ path_full: string }>;
      };
    }
  >;

  const entry = data[String(appId)];
  if (!entry?.success || !entry.data) return null;
  const d = entry.data;

  const firstMovie = d.movies?.[0];
  const trailerUrl =
    firstMovie?.mp4?.max ??
    firstMovie?.mp4?.["480"] ??
    firstMovie?.webm?.max ??
    firstMovie?.webm?.["480"] ??
    null;

  return {
    appid: appId,
    title: d.name,
    headerImage: d.header_image ?? null,
    shortDescription: d.short_description ?? "",
    detailedDescription: d.detailed_description ?? "",
    trailerUrl,
    steamUrl: `https://store.steampowered.com/app/${appId}`,
    genres: (d.genres ?? []).map((g) => g.description),
    categories: (d.categories ?? []).map((c) => c.description),
    releaseDate: d.release_date?.date ?? null,
    price: d.is_free
      ? "Kostenlos"
      : (d.price_overview?.final_formatted ?? null),
    screenshots: (d.screenshots ?? []).map((s) => s.path_full),
  };
}
