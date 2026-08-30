import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(new URL("../.env.production.local", import.meta.url));

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error(
    "DATABASE_URL fehlt. Dieses Skript liest .env.production.local - existiert die Datei?"
  );
  process.exit(1);
}

const db = createClient(authToken ? { url, authToken } : { url });

async function getSteamReviewSummary(appId) {
  const url = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const summary = data.query_summary;
  if (!data.success || !summary || !summary.total_reviews) return null;
  return {
    scoreDesc: summary.review_score_desc ?? "",
    positivePercent: Math.round(
      (summary.total_positive / summary.total_reviews) * 100
    ),
    totalReviews: summary.total_reviews,
  };
}

const REVIEW_SCORE_DESC_DE = {
  "Overwhelmingly Positive": "Überwältigend positiv",
  "Very Positive": "Sehr positiv",
  Positive: "Positiv",
  "Mostly Positive": "Größtenteils positiv",
  Mixed: "Ausgeglichen",
  "Mostly Negative": "Größtenteils negativ",
  Negative: "Negativ",
  "Very Negative": "Sehr negativ",
  "Overwhelmingly Negative": "Überwältigend negativ",
};

const res = await db.execute(
  `SELECT id, steam_appid, title FROM games WHERE steam_appid IS NOT NULL AND review_total IS NULL`
);

console.log(`${res.rows.length} Spiel(e) ohne Bewertungsdaten gefunden.`);

for (const row of res.rows) {
  const appid = row.steam_appid;
  const title = row.title;
  try {
    const summary = await getSteamReviewSummary(appid);
    if (!summary) {
      console.log(`- ${title}: keine Bewertungen bei Steam gefunden`);
      continue;
    }
    const desc = REVIEW_SCORE_DESC_DE[summary.scoreDesc] ?? summary.scoreDesc;
    await db.execute({
      sql: `UPDATE games SET review_score_desc = ?, review_positive_percent = ?, review_total = ? WHERE id = ?`,
      args: [desc, summary.positivePercent, summary.totalReviews, row.id],
    });
    console.log(
      `- ${title}: ${desc} (${summary.positivePercent}% · ${summary.totalReviews} Bewertungen)`
    );
  } catch (err) {
    console.error(`- ${title}: Fehler`, err);
  }
}

console.log("Fertig.");
