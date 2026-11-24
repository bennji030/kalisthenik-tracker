/** Daily Health totals. Only these values are stored, nothing about the sender. */
export interface DayValues {
  steps?: number;
  kcal?: number;
  proteinG?: number;
}

export interface Day extends DayValues {
  date: string;
}

/** What the routes need. A later Node/Deno server can supply its own implementation. */
export interface DayStore {
  /** Stores the day, replacing any previous values for that date. */
  put(date: string, values: DayValues): Promise<void>;
  /** All days with date >= `date`, sorted ascending. */
  since(date: string): Promise<Day[]>;
  /** Deletes all days with date <= `date`. */
  deleteUntil(date: string): Promise<void>;
}

/** The part of Cloudflare's KV namespace the store uses. */
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

const PREFIX = 'day:';
/** 30 days: values expire even if they are never fetched. */
export const TTL_SECONDS = 2592000;

async function allKeys(kv: KVNamespace): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await kv.list(cursor === undefined ? { prefix: PREFIX } : { prefix: PREFIX, cursor });
    for (const k of page.keys) names.push(k.name);
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return names.sort();
}

/** One KV key per day (`day:YYYY-MM-DD`), JSON value. */
export function kvStore(kv: KVNamespace): DayStore {
  return {
    async put(date, values) {
      await kv.put(PREFIX + date, JSON.stringify(values), { expirationTtl: TTL_SECONDS });
    },
    async since(date) {
      const keys = (await allKeys(kv)).filter((k) => k >= PREFIX + date);
      const days: Day[] = [];
      for (const key of keys) {
        const raw = await kv.get(key);
        // A key can expire between list() and get().
        if (raw === null) continue;
        days.push({ date: key.slice(PREFIX.length), ...(JSON.parse(raw) as DayValues) });
      }
      return days;
    },
    async deleteUntil(date) {
      const keys = (await allKeys(kv)).filter((k) => k <= PREFIX + date);
      for (const key of keys) await kv.delete(key);
    },
  };
}
