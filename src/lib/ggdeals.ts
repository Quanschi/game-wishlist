const GG_DEALS_API = "https://api.gg.deals/v1/prices/by-steam-app-id/";
const CHUNK_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Liefert für jede Steam-App-ID die passende gg.deals-URL, oder null wenn nicht gefunden. */
export async function getGgDealsUrls(
  appIds: number[]
): Promise<Record<number, string | null>> {
  const apiKey = process.env.GG_DEALS_API_KEY;
  const result: Record<number, string | null> = {};
  if (!apiKey || appIds.length === 0) {
    for (const id of appIds) result[id] = null;
    return result;
  }

  for (const batch of chunk(appIds, CHUNK_SIZE)) {
    try {
      const url = `${GG_DEALS_API}?ids=${batch.join(",")}&key=${apiKey}&region=de`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) {
        for (const id of batch) result[id] = null;
        continue;
      }
      const data = (await res.json()) as {
        success?: boolean;
        data?: Record<string, { url?: string } | null>;
      };
      for (const id of batch) {
        const entry = data.data?.[String(id)];
        result[id] = entry?.url ?? null;
      }
    } catch {
      for (const id of batch) result[id] = null;
    }
  }

  return result;
}
