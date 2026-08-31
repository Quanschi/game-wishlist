import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let initialized = false;

function getClient(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL ?? "file:local.db";
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    client = createClient(authToken ? { url, authToken } : { url });
  }
  return client;
}

async function migrate(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      steam_appid INTEGER,
      title TEXT NOT NULL,
      header_image TEXT,
      short_description TEXT,
      detailed_description TEXT,
      trailer_url TEXT,
      steam_url TEXT,
      genres TEXT NOT NULL DEFAULT '[]',
      categories TEXT NOT NULL DEFAULT '[]',
      release_date TEXT,
      price TEXT,
      status TEXT NOT NULL DEFAULT 'pending_add',
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      decided_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game_id, type, user_id)
    )
  `);

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_approvals_game ON approvals(game_id, type)`
  );

  const columns = await db.execute(`PRAGMA table_info(games)`);
  const existing = new Set(columns.rows.map((r) => r.name as string));
  const reviewColumns: [string, string][] = [
    ["review_score_desc", "TEXT"],
    ["review_positive_percent", "INTEGER"],
    ["review_total", "INTEGER"],
    ["pre_remove_status", "TEXT"],
    ["original_price", "TEXT"],
    ["discount_percent", "INTEGER NOT NULL DEFAULT 0"],
    ["is_playing", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [name, type] of reviewColumns) {
    if (!existing.has(name)) {
      await db.execute(`ALTER TABLE games ADD COLUMN ${name} ${type}`);
    }
  }
}

export async function getDb(): Promise<Client> {
  const db = getClient();
  if (!initialized) {
    initialized = true;
    await migrate(db);
  }
  return db;
}
