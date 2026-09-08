import { getDb } from "./db";
import { getSteamAppDetails, getSteamPriceInfo } from "./steam";
import { getSteamWishlistAppIds } from "./steamWishlist";

const PRICE_TTL_MS = 20 * 60 * 1000;

export type PrivateWishlistItem = {
  appid: number;
  title: string;
  headerImage: string | null;
  shortDescription: string;
  steamUrl: string | null;
  price: string | null;
  originalPrice: string | null;
  discountPercent: number;
  reviewScoreDesc: string | null;
  reviewPositivePercent: number | null;
  reviewTotal: number | null;
  genres: string[];
  categories: string[];
  releaseDate: string | null;
};

type Row = {
  steam_appid: number;
  title: string;
  header_image: string | null;
  short_description: string | null;
  steam_url: string | null;
  price: string | null;
  original_price: string | null;
  discount_percent: number;
  review_score_desc: string | null;
  review_positive_percent: number | null;
  review_total: number | null;
  genres: string;
  categories: string;
  release_date: string | null;
  price_updated_at: string | null;
};

function rowToItem(row: Row): PrivateWishlistItem {
  return {
    appid: row.steam_appid,
    title: row.title,
    headerImage: row.header_image,
    shortDescription: row.short_description ?? "",
    steamUrl: row.steam_url,
    price: row.price,
    originalPrice: row.original_price,
    discountPercent: row.discount_percent ?? 0,
    reviewScoreDesc: row.review_score_desc,
    reviewPositivePercent: row.review_positive_percent,
    reviewTotal: row.review_total,
    genres: JSON.parse(row.genres) as string[],
    categories: JSON.parse(row.categories) as string[],
    releaseDate: row.release_date,
  };
}

export async function getSteamId(userId: string): Promise<string | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT steam_id64 FROM user_steam_ids WHERE user_id = ?`,
    args: [userId],
  });
  return (res.rows[0]?.steam_id64 as string | undefined) ?? null;
}

export async function setSteamId(
  userId: string,
  steamId64: string
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO user_steam_ids (user_id, steam_id64) VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET steam_id64 = excluded.steam_id64, updated_at = datetime('now')`,
    args: [userId, steamId64],
  });
}

/** Gleicht den Cache mit der aktuellen Steam-Wishlist ab (neu/entfernt) und aktualisiert veraltete Preise. */
export async function refreshPrivateWishlist(userId: string): Promise<void> {
  const steamId64 = await getSteamId(userId);
  if (!steamId64) return;

  const db = await getDb();
  const wishlistEntries = await getSteamWishlistAppIds(steamId64);
  const liveAppIds = new Set(wishlistEntries.map((e) => e.appid));

  const cached = await db.execute({
    sql: `SELECT steam_appid, price_updated_at FROM private_wishlist_items WHERE user_id = ?`,
    args: [userId],
  });
  const cachedAppIds = new Set(cached.rows.map((r) => r.steam_appid as number));
  const cachedByAppId = new Map(
    cached.rows.map((r) => [
      r.steam_appid as number,
      r.price_updated_at as string | null,
    ])
  );

  // Entfernte Spiele: nicht mehr auf der echten Wishlist -> aus dem Cache löschen.
  const toRemove = [...cachedAppIds].filter((id) => !liveAppIds.has(id));
  if (toRemove.length > 0) {
    const placeholders = toRemove.map(() => "?").join(",");
    await db.execute({
      sql: `DELETE FROM private_wishlist_items WHERE user_id = ? AND steam_appid IN (${placeholders})`,
      args: [userId, ...toRemove],
    });
  }

  const now = Date.now();

  await Promise.all(
    wishlistEntries.map(async (entry) => {
      if (!cachedAppIds.has(entry.appid)) {
        // Neu: volle Details holen.
        const details = await getSteamAppDetails(entry.appid);
        if (!details) return;
        await db.execute({
          sql: `INSERT INTO private_wishlist_items (
            user_id, steam_appid, title, header_image, short_description, steam_url,
            price, original_price, discount_percent,
            review_score_desc, review_positive_percent, review_total,
            genres, categories, release_date, price_updated_at, date_added
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
          ON CONFLICT(user_id, steam_appid) DO NOTHING`,
          args: [
            userId,
            details.appid,
            details.title,
            details.headerImage,
            details.shortDescription,
            details.steamUrl,
            details.price,
            details.originalPrice,
            details.discountPercent,
            details.reviews?.scoreDesc ?? null,
            details.reviews?.positivePercent ?? null,
            details.reviews?.totalReviews ?? null,
            JSON.stringify(details.genres),
            JSON.stringify(details.categories),
            details.releaseDate,
            entry.dateAdded,
          ],
        });
        return;
      }

      // Bereits im Cache: Preis nur auffrischen, wenn er älter als das TTL ist.
      const priceUpdatedAt = cachedByAppId.get(entry.appid);
      if (
        priceUpdatedAt &&
        now - new Date(priceUpdatedAt + "Z").getTime() < PRICE_TTL_MS
      ) {
        return;
      }
      const info = await getSteamPriceInfo(entry.appid);
      if (!info) return;
      await db.execute({
        sql: `UPDATE private_wishlist_items SET price = ?, original_price = ?, discount_percent = ?, price_updated_at = datetime('now')
              WHERE user_id = ? AND steam_appid = ?`,
        args: [
          info.price,
          info.originalPrice,
          info.discountPercent,
          userId,
          entry.appid,
        ],
      });
    })
  );
}

export async function listPrivateWishlist(
  userId: string
): Promise<PrivateWishlistItem[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT * FROM private_wishlist_items WHERE user_id = ? ORDER BY date_added DESC NULLS LAST`,
    args: [userId],
  });
  return res.rows.map((r) => rowToItem(r as unknown as Row));
}
