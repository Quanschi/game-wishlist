import { getDb } from "./db";
import { getGgDealsUrls } from "./ggdeals";
import {
  getSteamAppDetails,
  getSteamDlcInfo,
  getSteamPriceInfo,
} from "./steam";
import { getSteamWishlistAppIds } from "./steamWishlist";
import type { DlcRowData } from "@/app/components/DlcRow";

const PRICE_TTL_MS = 20 * 60 * 1000;
const DLC_FETCH_LIMIT = 20;

export type PrivateWishlistItem = {
  appid: number;
  title: string;
  headerImage: string | null;
  shortDescription: string;
  steamUrl: string | null;
  price: string | null;
  originalPrice: string | null;
  discountPercent: number;
  ggDealsUrl: string | null;
  reviewScoreDesc: string | null;
  reviewPositivePercent: number | null;
  reviewTotal: number | null;
  requiresAppid: number | null;
  requiresTitle: string | null;
  genres: string[];
  categories: string[];
  releaseDate: string | null;
  dlcs: DlcRowData[];
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
  gg_deals_url: string | null;
  review_score_desc: string | null;
  review_positive_percent: number | null;
  review_total: number | null;
  requires_appid: number | null;
  requires_title: string | null;
  genres: string;
  categories: string;
  release_date: string | null;
  price_updated_at: string | null;
};

async function rowToItem(userId: string, row: Row): Promise<PrivateWishlistItem> {
  const db = await getDb();
  const dlcRes = await db.execute({
    sql: `SELECT dlc_appid, title, header_image, steam_url, price, original_price, discount_percent
          FROM private_wishlist_dlcs WHERE user_id = ? AND parent_appid = ? ORDER BY sort_order`,
    args: [userId, row.steam_appid],
  });
  return {
    appid: row.steam_appid,
    title: row.title,
    headerImage: row.header_image,
    shortDescription: row.short_description ?? "",
    steamUrl: row.steam_url,
    price: row.price,
    originalPrice: row.original_price,
    discountPercent: row.discount_percent ?? 0,
    ggDealsUrl: row.gg_deals_url,
    reviewScoreDesc: row.review_score_desc,
    reviewPositivePercent: row.review_positive_percent,
    reviewTotal: row.review_total,
    requiresAppid: row.requires_appid,
    requiresTitle: row.requires_title,
    genres: JSON.parse(row.genres) as string[],
    categories: JSON.parse(row.categories) as string[],
    releaseDate: row.release_date,
    dlcs: dlcRes.rows.map((r) => ({
      appid: r.dlc_appid as number,
      title: r.title as string,
      headerImage: r.header_image as string | null,
      steamUrl: r.steam_url as string | null,
      price: r.price as string | null,
      originalPrice: r.original_price as string | null,
      discountPercent: (r.discount_percent as number) ?? 0,
    })),
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

async function storeDlcsForPrivateItem(
  userId: string,
  parentAppid: number,
  dlcAppIds: number[]
): Promise<void> {
  const db = await getDb();
  const capped = dlcAppIds.slice(0, DLC_FETCH_LIMIT);
  const infos = await Promise.all(capped.map((appid) => getSteamDlcInfo(appid)));

  await Promise.all(
    infos.map(async (info, index) => {
      if (!info) return;
      await db.execute({
        sql: `INSERT INTO private_wishlist_dlcs (user_id, parent_appid, dlc_appid, title, header_image, steam_url, price, original_price, discount_percent, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, parent_appid, dlc_appid) DO UPDATE SET
                title = excluded.title, header_image = excluded.header_image, steam_url = excluded.steam_url,
                price = excluded.price, original_price = excluded.original_price, discount_percent = excluded.discount_percent`,
        args: [
          userId,
          parentAppid,
          info.appid,
          info.title,
          info.headerImage,
          info.steamUrl,
          info.price,
          info.originalPrice,
          info.discountPercent,
          index,
        ],
      });
    })
  );

  await db.execute({
    sql: `UPDATE private_wishlist_items SET dlc_checked = 1 WHERE user_id = ? AND steam_appid = ?`,
    args: [userId, parentAppid],
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
  const newAppIds = wishlistEntries
    .filter((e) => !cachedAppIds.has(e.appid))
    .map((e) => e.appid);
  const ggDealsUrls = await getGgDealsUrls(newAppIds);
  const ggDealsConfigured = Boolean(process.env.GG_DEALS_API_KEY);

  await Promise.all(
    wishlistEntries.map(async (entry) => {
      if (!cachedAppIds.has(entry.appid)) {
        // Neu: volle Details holen.
        const details = await getSteamAppDetails(entry.appid);
        if (!details) return;
        await db.execute({
          sql: `INSERT INTO private_wishlist_items (
            user_id, steam_appid, title, header_image, short_description, steam_url,
            price, original_price, discount_percent, gg_deals_url, gg_deals_checked,
            review_score_desc, review_positive_percent, review_total,
            requires_appid, requires_title,
            genres, categories, release_date, price_updated_at, date_added
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
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
            ggDealsUrls[entry.appid] ?? null,
            ggDealsConfigured ? 1 : 0,
            details.reviews?.scoreDesc ?? null,
            details.reviews?.positivePercent ?? null,
            details.reviews?.totalReviews ?? null,
            details.requiresAppid,
            details.requiresTitle,
            JSON.stringify(details.genres),
            JSON.stringify(details.categories),
            details.releaseDate,
            entry.dateAdded,
          ],
        });
        await storeDlcsForPrivateItem(userId, entry.appid, details.dlcAppIds);
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

  await fillMissingGgDealsUrls(userId);
  await fillMissingDlcs(userId);
}

async function fillMissingGgDealsUrls(userId: string): Promise<void> {
  if (!process.env.GG_DEALS_API_KEY) return;
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT steam_appid FROM private_wishlist_items WHERE user_id = ? AND gg_deals_checked = 0`,
    args: [userId],
  });
  const appids = res.rows.map((r) => r.steam_appid as number);
  if (appids.length === 0) return;

  const urls = await getGgDealsUrls(appids);
  await Promise.all(
    appids.map((appid) =>
      db.execute({
        sql: `UPDATE private_wishlist_items SET gg_deals_url = ?, gg_deals_checked = 1 WHERE user_id = ? AND steam_appid = ?`,
        args: [urls[appid] ?? null, userId, appid],
      })
    )
  );
}

async function fillMissingDlcs(userId: string): Promise<void> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT steam_appid FROM private_wishlist_items WHERE user_id = ? AND dlc_checked = 0`,
    args: [userId],
  });
  const appids = res.rows.map((r) => r.steam_appid as number);
  if (appids.length === 0) return;

  await Promise.all(
    appids.map(async (appid) => {
      const details = await getSteamAppDetails(appid);
      await storeDlcsForPrivateItem(userId, appid, details?.dlcAppIds ?? []);
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
  return Promise.all(
    res.rows.map((r) => rowToItem(userId, r as unknown as Row))
  );
}
