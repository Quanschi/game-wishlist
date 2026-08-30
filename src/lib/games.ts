import { getDb } from "./db";
import { getOtherUserId } from "./auth";
import type { SteamGameDetails } from "./steam";

export type GameStatus =
  | "pending_add"
  | "active"
  | "pending_complete"
  | "completed"
  | "rejected";

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
  status: GameStatus;
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
  status: string;
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
    status: row.status as GameStatus,
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
      status, requested_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_add', ?)
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
    sql: `SELECT * FROM games WHERE status IN ('pending_add','pending_complete')`,
    args: [],
  });
  const games = await Promise.all(
    res.rows.map((r) => rowToGame(r as unknown as GameRow))
  );
  const pendingType = (g: Game) =>
    g.status === "pending_add" ? "add" : "complete";
  return games.filter(
    (g) => !g.approvals.some((a) => a.type === pendingType(g) && a.userId === userId)
  );
}

async function finalizeIfBothDecided(
  gameId: number,
  type: "add" | "complete"
): Promise<void> {
  const game = await getGameById(gameId);
  if (!game) return;
  const decisions = game.approvals.filter((a) => a.type === type);
  if (decisions.length < 2) return;

  const db = await getDb();
  const anyRejected = decisions.some((d) => d.decision === "rejected");
  if (anyRejected) {
    if (type === "add") {
      await db.execute({ sql: `DELETE FROM games WHERE id = ?`, args: [gameId] });
    } else {
      await db.execute({
        sql: `UPDATE games SET status = 'active' WHERE id = ?`,
        args: [gameId],
      });
      await db.execute({
        sql: `DELETE FROM approvals WHERE game_id = ? AND type = 'complete'`,
        args: [gameId],
      });
    }
    return;
  }

  if (type === "add") {
    await db.execute({
      sql: `UPDATE games SET status = 'active' WHERE id = ?`,
      args: [gameId],
    });
  } else {
    await db.execute({
      sql: `UPDATE games SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
      args: [gameId],
    });
  }
}

export async function decide(
  gameId: number,
  type: "add" | "complete",
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

export async function getRandomActiveGame(tag?: string): Promise<Game | null> {
  const games = await listGames({ statuses: ["active"], tag });
  if (games.length === 0) return null;
  return games[Math.floor(Math.random() * games.length)];
}

export function otherUser(userId: string): string | null {
  return getOtherUserId(userId);
}
