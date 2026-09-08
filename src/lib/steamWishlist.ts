export type SteamWishlistEntry = {
  appid: number;
  dateAdded: number | null;
};

/** Liefert die Steam-App-IDs einer öffentlichen Wishlist, neueste zuerst. */
export async function getSteamWishlistAppIds(
  steamId64: string
): Promise<SteamWishlistEntry[]> {
  const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${encodeURIComponent(steamId64)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: {
        items?: Array<{ appid: number; date_added?: number }>;
      };
    };
    const items = data.response?.items ?? [];
    return items
      .map((item) => ({
        appid: item.appid,
        dateAdded: item.date_added ?? null,
      }))
      .sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0));
  } catch {
    return [];
  }
}
