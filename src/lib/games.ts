import { getDb } from "./db";
import { getOtherUserId } from "./auth";
import { getGgDealsUrls } from "./ggdeals";
import { notifyAllUsers, notifyOtherUser } from "./push";
import {
  getSteamDlcInfo,
  getSteamDlcList,
  getSteamPriceInfo,
  type SteamGameDetails,
} from "./steam";

const PRICE_TTL_MS = 20 * 60 * 1000;
const DLC_FETCH_LIMIT = 20;

export type GameStatus =
  | "pending_add"
  | "active"
  | "pending_complete"
  | "completed"
  | "pending_remove"
  | "rejected";

type ApprovalType = "add" | "complete" | "remove";

export type GameDlc = {
  appid: number;
  title: string;
  headerImage: string | null;
  steamUrl: string | null;
  price: string | null;
  originalPrice: string | null;
  discountPercent: number;
};

function pendingTypeOf(status: GameStatus): ApprovalType | null {
  if (status === "pending_add") return "add";
  if (status === "pending_complete") return "complete";
  if (status === "pending_remove") return "remove";
  return null;
}

export type Game = {
  id: number;
  steamAppid: number | null;
  title: string;
  headerImage: string | null;
  shortDescription: string;
  detailedDescription: string;
  trailerUrl: string | null;
  steamUrl: string | null;
  genres: string[];
  categories: string[];
  releaseDate: string | null;
  price: string | null;
  originalPrice: string | null;
  discountPercent: number;
  priceUpdatedAt: string | null;
  ggDealsUrl: string | null;
  reviewScoreDesc: string | null;
  reviewPositivePercent: number | null;
  reviewTotal: number | null;
  status: GameStatus;
  isPlaying: boolean;
  requestedBy: string;
  requestedAt: string;
  completedAt: string | null;
  approvals: { type: string; userId: string; decision: string }[];
  dlcs: GameDlc[];
};

type GameRow = {
  id: number;
  steam_appid: number | null;
  title: string;
  header_image: string | null;
  short_description: string | null;
  detailed_description: string | null;
  trailer_url: string | null;
  steam_url: string | null;
  genres: string;
  categories: string;
  release_date: string | null;
  price: string | null;
  original_price: string | null;
  discount_percent: number;
  price_updated_at: string | null;
  gg_deals_url: string | null;
  gg_deals_checked: number;
  review_score_desc: string | null;
  review_positive_percent: number | null;
  review_total: number | null;
  status: string;
  is_playing: number;
  requested_by: string;
  requested_at: string;
  completed_at: string | null;
};

async function rowToGame(row: GameRow): Promise<Game> {
  const db = await getDb();
  const approvalsResult = await db.execute({
    sql: `SELECT type, user_id, decision FROM approvals WHERE game_id = ?`,
    args: [row.id],
  });
  const dlcResult = await db.execute({
    sql: `SELECT dlc_appid, title, header_image, steam_url, price, original_price, discount_percent
          FROM game_dlcs WHERE game_id = ? ORDER BY sort_order`,
    args: [row.id],
  });
  return {
    id: row.id,
    steamAppid: row.steam_appid,
    title: row.title,
    headerImage: row.header_image,
    shortDescription: row.short_description ?? "",
    detailedDescription: row.detailed_description ?? "",
    trailerUrl: row.trailer_url,
    steamUrl: row.steam_url,
    genres: JSON.parse(row.genres) as string[],
    categories: JSON.parse(row.categories) as string[],
    releaseDate: row.release_date,
    price: row.price,
    originalPrice: row.original_price,
    discountPercent: row.discount_percent ?? 0,
    priceUpdatedAt: row.price_updated_at,
    ggDealsUrl: row.gg_deals_url,
    reviewScoreDesc: row.review_score_desc,
    reviewPositivePercent: row.review_positive_percent,
    reviewTotal: row.review_total,
    status: row.status as GameStatus,
    isPlaying: Boolean(row.is_playing),
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    approvals: approvalsResult.rows.map((r) => ({
      type: r.type as string,
      userId: r.user_id as string,
      decision: r.decision as string,
    })),
    dlcs: dlcResult.rows.map((r) => ({
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

export async function createGameRequest(
  details: SteamGameDetails,
  requestedBy: string
): Promise<Game> {
  const db = await getDb();

  const existing = await db.execute({
    sql: `SELECT id FROM games WHERE steam_appid = ? AND status IN ('pending_add','active','pending_complete','completed')`,
    args: [details.appid],
  });
  if (existing.rows.length > 0) {
    throw new Error("DUPLICATE");
  }

  const result = await db.execute({
    sql: `INSERT INTO games (
      steam_appid, title, header_image, short_description, detailed_description,
      trailer_url, steam_url, genres, categories, release_date, price,
      original_price, discount_percent, price_updated_at,
      review_score_desc, review_positive_percent, review_total,
      status, requested_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, 'pending_add', ?)
    RETURNING id`,
    args: [
      details.appid,
      details.title,
      details.headerImage,
      details.shortDescription,
      details.detailedDescription,
      details.trailerUrl,
      details.steamUrl,
      JSON.stringify(details.genres),
      JSON.stringify(details.categories),
      details.releaseDate,
      details.price,
      details.originalPrice,
      details.discountPercent,
      details.reviews?.scoreDesc ?? null,
      details.reviews?.positivePercent ?? null,
      details.reviews?.totalReviews ?? null,
      requestedBy,
    ],
  });
  const id = Number(result.rows[0].id);

  await storeDlcsForGame(id, details.dlcAppIds);

  await db.execute({
    sql: `INSERT INTO approvals (game_id, type, user_id, decision) VALUES (?, 'add', ?, 'approved')`,
    args: [id, requestedBy],
  });

  const game = await getGameById(id);
  if (!game) throw new Error("Konnte Spiel nicht laden nach dem Anlegen");

  await notifyOtherUser(requestedBy, {
    title: "Neuer Spielvorschlag",
    body: `${requestedBy} möchte "${game.title}" zur Liste hinzufügen`,
  });

  return game;
}

async function storeDlcsForGame(gameId: number, dlcAppIds: number[]): Promise<void> {
  const db = await getDb();
  const capped = dlcAppIds.slice(0, DLC_FETCH_LIMIT);

  const infos = await Promise.all(capped.map((appid) => getSteamDlcInfo(appid)));

  await Promise.all(
    infos.map(async (info, index) => {
      if (!info) return;
      await db.execute({
        sql: `INSERT INTO game_dlcs (game_id, dlc_appid, title, header_image, steam_url, price, original_price, discount_percent, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(game_id, dlc_appid) DO UPDATE SET
                title = excluded.title, header_image = excluded.header_image, steam_url = excluded.steam_url,
                price = excluded.price, original_price = excluded.original_price, discount_percent = excluded.discount_percent`,
        args: [
          gameId,
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
    sql: `UPDATE games SET dlc_checked = 1 WHERE id = ?`,
    args: [gameId],
  });
}

async function fillMissingDlcs(games: Game[]): Promise<Game[]> {
  const db = await getDb();
  const ids = games.map((g) => g.id);
  if (ids.length === 0) return games;

  const placeholders = ids.map(() => "?").join(",");
  const res = await db.execute({
    sql: `SELECT id, steam_appid FROM games WHERE dlc_checked = 0 AND steam_appid IS NOT NULL AND id IN (${placeholders})`,
    args: ids,
  });
  const pending = res.rows.map((r) => ({
    id: r.id as number,
    steamAppid: r.steam_appid as number,
  }));
  if (pending.length === 0) return games;

  await Promise.all(
    pending.map(async (p) => {
      const dlcAppIds = await getSteamDlcList(p.steamAppid);
      await storeDlcsForGame(p.id, dlcAppIds);
      const dlcRes = await db.execute({
        sql: `SELECT dlc_appid, title, header_image, steam_url, price, original_price, discount_percent
              FROM game_dlcs WHERE game_id = ? ORDER BY sort_order`,
        args: [p.id],
      });
      const game = games.find((g) => g.id === p.id);
      if (game) {
        game.dlcs = dlcRes.rows.map((r) => ({
          appid: r.dlc_appid as number,
          title: r.title as string,
          headerImage: r.header_image as string | null,
          steamUrl: r.steam_url as string | null,
          price: r.price as string | null,
          originalPrice: r.original_price as string | null,
          discountPercent: (r.discount_percent as number) ?? 0,
        }));
      }
    })
  );

  return games;
}

export async function getGameById(id: number): Promise<Game | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT * FROM games WHERE id = ?`,
    args: [id],
  });
  if (res.rows.length === 0) return null;
  const games = await refreshStalePrices([
    await rowToGame(res.rows[0] as unknown as GameRow),
  ]);
  const [game] = await fillMissingDlcs(await fillMissingGgDealsUrls(games));
  return game;
}

async function refreshStalePrices(
  games: Game[],
  force = false
): Promise<Game[]> {
  const db = await getDb();
  const now = Date.now();

  await Promise.all(
    games.map(async (game) => {
      if (!game.steamAppid) return;
      if (
        !force &&
        game.priceUpdatedAt &&
        now - new Date(game.priceUpdatedAt + "Z").getTime() < PRICE_TTL_MS
      ) {
        return;
      }

      const info = await getSteamPriceInfo(game.steamAppid);
      await db.execute({
        sql: `UPDATE games SET price = ?, original_price = ?, discount_percent = ?, price_updated_at = datetime('now') WHERE id = ?`,
        args: [
          info?.price ?? game.price,
          info?.originalPrice ?? null,
          info?.discountPercent ?? 0,
          game.id,
        ],
      });

      const oldDiscount = game.discountPercent;
      const newDiscount = info?.discountPercent ?? 0;

      game.price = info?.price ?? game.price;
      game.originalPrice = info?.originalPrice ?? null;
      game.discountPercent = newDiscount;
      game.priceUpdatedAt = new Date().toISOString();

      if (
        info &&
        newDiscount > 0 &&
        oldDiscount <= 0 &&
        (game.status === "active" || game.status === "completed")
      ) {
        await notifyAllUsers({
          title: "🏷️ Sale!",
          body: `"${game.title}" ist gerade im Sale: -${newDiscount}% für ${info.price}`,
        });
      }

      if (game.dlcs.length > 0) {
        await Promise.all(
          game.dlcs.map(async (dlc) => {
            const dlcInfo = await getSteamPriceInfo(dlc.appid);
            if (!dlcInfo) return;
            await db.execute({
              sql: `UPDATE game_dlcs SET price = ?, original_price = ?, discount_percent = ? WHERE game_id = ? AND dlc_appid = ?`,
              args: [
                dlcInfo.price,
                dlcInfo.originalPrice,
                dlcInfo.discountPercent,
                game.id,
                dlc.appid,
              ],
            });
            dlc.price = dlcInfo.price;
            dlc.originalPrice = dlcInfo.originalPrice;
            dlc.discountPercent = dlcInfo.discountPercent;
          })
        );
      }
    })
  );

  return games;
}

async function fillMissingGgDealsUrls(games: Game[]): Promise<Game[]> {
  const db = await getDb();
  const ids = games.map((g) => g.id);
  if (ids.length === 0) return games;

  const placeholders = ids.map(() => "?").join(",");
  const res = await db.execute({
    sql: `SELECT id, steam_appid FROM games WHERE gg_deals_checked = 0 AND steam_appid IS NOT NULL AND id IN (${placeholders})`,
    args: ids,
  });
  const pending = res.rows.map((r) => ({
    id: r.id as number,
    steamAppid: r.steam_appid as number,
  }));
  // Ohne Key gar nicht erst als "geprüft" markieren, sonst wird es nie
  // nachgeholt, sobald der Key später konfiguriert wird.
  if (pending.length === 0 || !process.env.GG_DEALS_API_KEY) return games;

  const urls = await getGgDealsUrls(pending.map((p) => p.steamAppid));
  await Promise.all(
    pending.map(async (p) => {
      const url = urls[p.steamAppid] ?? null;
      await db.execute({
        sql: `UPDATE games SET gg_deals_url = ?, gg_deals_checked = 1 WHERE id = ?`,
        args: [url, p.id],
      });
      const game = games.find((g) => g.id === p.id);
      if (game) game.ggDealsUrl = url;
    })
  );

  return games;
}

export async function forceRefreshAllPrices(): Promise<void> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT * FROM games WHERE status IN ('active','completed') AND steam_appid IS NOT NULL`,
    args: [],
  });
  const games = await Promise.all(
    res.rows.map((r) => rowToGame(r as unknown as GameRow))
  );
  await refreshStalePrices(games, true);
}

export async function listGames(filter: {
  statuses: GameStatus[];
  search?: string;
  tag?: string;
}): Promise<Game[]> {
  const db = await getDb();
  const placeholders = filter.statuses.map(() => "?").join(",");
  const args: (string | number)[] = [...filter.statuses];
  let sql = `SELECT * FROM games WHERE status IN (${placeholders})`;
  if (filter.search) {
    sql += ` AND title LIKE ?`;
    args.push(`%${filter.search}%`);
  }
  sql += ` ORDER BY requested_at DESC`;
  const res = await db.execute({ sql, args });
  const games = await fillMissingDlcs(
    await fillMissingGgDealsUrls(
      await refreshStalePrices(
        await Promise.all(res.rows.map((r) => rowToGame(r as unknown as GameRow)))
      )
    )
  );
  if (filter.tag) {
    return games.filter(
      (g) => g.genres.includes(filter.tag!) || g.categories.includes(filter.tag!)
    );
  }
  return games;
}

export async function listPendingForUser(userId: string): Promise<Game[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT * FROM games WHERE status IN ('pending_add','pending_complete','pending_remove')`,
    args: [],
  });
  const games = await fillMissingDlcs(
    await fillMissingGgDealsUrls(
      await Promise.all(res.rows.map((r) => rowToGame(r as unknown as GameRow)))
    )
  );
  return games.filter((g) => {
    const type = pendingTypeOf(g.status);
    return type && !g.approvals.some((a) => a.type === type && a.userId === userId);
  });
}

export async function listMyOpenRequests(userId: string): Promise<Game[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT * FROM games WHERE status IN ('pending_add','pending_complete','pending_remove')`,
    args: [],
  });
  const games = await fillMissingDlcs(
    await fillMissingGgDealsUrls(
      await Promise.all(res.rows.map((r) => rowToGame(r as unknown as GameRow)))
    )
  );
  return games.filter((g) => {
    const type = pendingTypeOf(g.status);
    return type && g.approvals.some((a) => a.type === type && a.userId === userId);
  });
}

async function revertPending(gameId: number, type: ApprovalType): Promise<void> {
  const db = await getDb();

  if (type === "add") {
    await db.execute({ sql: `DELETE FROM games WHERE id = ?`, args: [gameId] });
    return;
  }

  if (type === "complete") {
    await db.execute({
      sql: `UPDATE games SET status = 'active' WHERE id = ?`,
      args: [gameId],
    });
    await db.execute({
      sql: `DELETE FROM approvals WHERE game_id = ? AND type = 'complete'`,
      args: [gameId],
    });
    return;
  }

  // type === "remove"
  const row = await db.execute({
    sql: `SELECT pre_remove_status FROM games WHERE id = ?`,
    args: [gameId],
  });
  const preStatus = (row.rows[0]?.pre_remove_status as string | null) ?? "active";
  await db.execute({
    sql: `UPDATE games SET status = ?, pre_remove_status = NULL WHERE id = ?`,
    args: [preStatus, gameId],
  });
  await db.execute({
    sql: `DELETE FROM approvals WHERE game_id = ? AND type = 'remove'`,
    args: [gameId],
  });
}

async function finalizeIfBothDecided(
  gameId: number,
  type: ApprovalType
): Promise<void> {
  const game = await getGameById(gameId);
  if (!game) return;
  const decisions = game.approvals.filter((a) => a.type === type);
  if (decisions.length < 2) return;

  const anyRejected = decisions.some((d) => d.decision === "rejected");
  if (anyRejected) {
    await revertPending(gameId, type);
    return;
  }

  const db = await getDb();
  if (type === "add") {
    await db.execute({
      sql: `UPDATE games SET status = 'active' WHERE id = ?`,
      args: [gameId],
    });
  } else if (type === "complete") {
    await db.execute({
      sql: `UPDATE games SET status = 'completed', completed_at = datetime('now'), is_playing = 0 WHERE id = ?`,
      args: [gameId],
    });
  } else {
    await db.execute({ sql: `DELETE FROM games WHERE id = ?`, args: [gameId] });
  }
}

export async function withdrawRequest(
  gameId: number,
  userId: string
): Promise<void> {
  const game = await getGameById(gameId);
  if (!game) throw new Error("Nicht gefunden");
  const type = pendingTypeOf(game.status);
  if (!type) throw new Error("Diese Anfrage ist nicht mehr offen");
  const hasDecided = game.approvals.some(
    (a) => a.type === type && a.userId === userId
  );
  if (!hasDecided) throw new Error("Du hast diese Anfrage nicht gestellt");
  await revertPending(gameId, type);
}

export async function decide(
  gameId: number,
  type: ApprovalType,
  userId: string,
  decision: "approved" | "rejected"
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO approvals (game_id, type, user_id, decision) VALUES (?, ?, ?, ?)
          ON CONFLICT(game_id, type, user_id) DO UPDATE SET decision = excluded.decision, decided_at = datetime('now')`,
    args: [gameId, type, userId, decision],
  });
  await finalizeIfBothDecided(gameId, type);
}

export async function requestCompletion(
  gameId: number,
  userId: string
): Promise<void> {
  const db = await getDb();
  const game = await getGameById(gameId);
  if (!game || game.status !== "active") {
    throw new Error("Spiel ist nicht aktiv");
  }
  await db.execute({
    sql: `UPDATE games SET status = 'pending_complete' WHERE id = ?`,
    args: [gameId],
  });
  await db.execute({
    sql: `INSERT INTO approvals (game_id, type, user_id, decision) VALUES (?, 'complete', ?, 'approved')`,
    args: [gameId, userId],
  });
  await finalizeIfBothDecided(gameId, "complete");

  await notifyOtherUser(userId, {
    title: "Durchgespielt-Markierung",
    body: `${userId} möchte "${game.title}" als durchgespielt markieren`,
  });
}

export async function requestRemoval(
  gameId: number,
  userId: string
): Promise<void> {
  const db = await getDb();
  const game = await getGameById(gameId);
  if (!game || (game.status !== "active" && game.status !== "completed")) {
    throw new Error("Spiel kann gerade nicht entfernt werden");
  }
  await db.execute({
    sql: `UPDATE games SET status = 'pending_remove', pre_remove_status = ? WHERE id = ?`,
    args: [game.status, gameId],
  });
  await db.execute({
    sql: `INSERT INTO approvals (game_id, type, user_id, decision) VALUES (?, 'remove', ?, 'approved')`,
    args: [gameId, userId],
  });
  await finalizeIfBothDecided(gameId, "remove");

  await notifyOtherUser(userId, {
    title: "Entfernen-Anfrage",
    body: `${userId} möchte "${game.title}" von der Liste entfernen`,
  });
}

export async function reopenGame(gameId: number): Promise<void> {
  const db = await getDb();
  const game = await getGameById(gameId);
  if (!game || game.status !== "completed") {
    throw new Error("Spiel ist nicht als durchgespielt markiert");
  }
  await db.execute({
    sql: `UPDATE games SET status = 'active', completed_at = NULL WHERE id = ?`,
    args: [gameId],
  });
  await db.execute({
    sql: `DELETE FROM approvals WHERE game_id = ? AND type = 'complete'`,
    args: [gameId],
  });
}

export async function setPlaying(
  gameId: number,
  playing: boolean,
  userId: string
): Promise<void> {
  const db = await getDb();
  const game = await getGameById(gameId);
  if (!game || game.status !== "active") {
    throw new Error("Spiel ist nicht aktiv");
  }
  await db.execute({
    sql: `UPDATE games SET is_playing = ? WHERE id = ?`,
    args: [playing ? 1 : 0, gameId],
  });

  if (playing) {
    await notifyOtherUser(userId, {
      title: "🎮 Euer aktuelles Spiel",
      body: `${userId} hat "${game.title}" als das Spiel markiert, das ihr gerade spielt`,
    });
  }
}

export async function getRandomActiveGame(tag?: string): Promise<Game | null> {
  const games = await listGames({ statuses: ["active"], tag });
  if (games.length === 0) return null;
  return games[Math.floor(Math.random() * games.length)];
}

export function otherUser(userId: string): string | null {
  return getOtherUserId(userId);
}
