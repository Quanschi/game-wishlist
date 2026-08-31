import webpush from "web-push";
import { getDb } from "./db";
import { getOtherUserId } from "./auth";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export async function saveSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    args: [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `DELETE FROM push_subscriptions WHERE endpoint = ?`,
    args: [endpoint],
  });
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  if (!isConfigured()) return;
  configureWebPush();

  const db = await getDb();
  const res = await db.execute({
    sql: `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`,
    args: [userId],
  });

  await Promise.all(
    res.rows.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint as string,
        keys: {
          p256dh: row.p256dh as string,
          auth: row.auth as string,
        },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscription(subscription.endpoint);
        }
      }
    })
  );
}

export async function notifyOtherUser(
  currentUserId: string,
  payload: PushPayload
): Promise<void> {
  const otherUserId = getOtherUserId(currentUserId);
  if (!otherUserId) return;
  await sendPushToUser(otherUserId, payload);
}
