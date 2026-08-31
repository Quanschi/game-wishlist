import { getDb } from "./db";
import { getOtherUserId } from "./auth";
import { notifyOtherUser } from "./push";
import type { SteamGameDetails } from "./steam";

export type GameStatus =
  | "pending_add"
  | "active"
  | "pending_complete"
  | "completed"
  | "pending_remove"
  | "rejected";

type ApprovalType = "add" | "complete" | "remove";

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
  reviewScoreDesc: string | null;
  reviewPositivePercent: number | null;
  reviewTotal: number | null;
  status: GameStatus;
  isPlaying: boolean;
  requestedBy: string;
  requestedAt: string;
  completedAt: string | null;
  approvals: { type: string; userId: string; decision: string }[];
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
      original_price, discount_percent,
      review_score_desc, review_positive_percent, review_total,
      status, requested_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_add', ?)
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

export async function getGameById(id: number): Promise<Game | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT * FROM games WHERE id = ?`,
    args: [id],
  });
  if (res.rows.length === 0) return null;
  return rowToGame(res.rows[0] as unknown as GameRow);
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
  const games = await Promise.all(
    res.rows.map((r) => rowToGame(r as unknown as GameRow))
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
  const games = await Promise.all(
    res.rows.map((r) => rowToGame(r as unknown as GameRow))
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
  const games = await Promise.all(
    res.rows.map((r) => rowToGame(r as unknown as GameRow))
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
      title: "🎮 Gerade am Spielen",
      body: `${userId} spielt gerade "${game.title}"`,
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
