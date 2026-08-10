import { createServerFn } from "@tanstack/react-start";

export type PublicStats = {
  members: number;
  families: number;
  checkins: number;
  sessions: number;
  active_listeners: number;
  avg_rating: number | null;
  rating_count: number;
};

const FALLBACK: PublicStats = {
  members: 0,
  families: 0,
  checkins: 0,
  sessions: 0,
  active_listeners: 0,
  avg_rating: null,
  rating_count: 0,
};

/**
 * Public, aggregate-only stats for the landing page.
 * Reads through a publishable-key client and a security-definer RPC that
 * returns counts only — no user rows, no PII.
 */
export const getPublicStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStats> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return FALLBACK;

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(url, key, {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            if (
              key.startsWith("sb_") &&
              headers.get("Authorization") === `Bearer ${key}`
            ) {
              headers.delete("Authorization");
            }
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          },
        },
      });

      const { data, error } = await client.rpc("get_public_stats");
      if (error || !data) return FALLBACK;
      const d = data as Record<string, unknown>;
      return {
        members: Number(d["members"] ?? 0),
        families: Number(d["families"] ?? 0),
        checkins: Number(d["checkins"] ?? 0),
        sessions: Number(d["sessions"] ?? 0),
        active_listeners: Number(d["active_listeners"] ?? 0),
        avg_rating: d["avg_rating"] == null ? null : Number(d["avg_rating"]),
        rating_count: Number(d["rating_count"] ?? 0),
      };
    } catch {
      return FALLBACK;
    }
  },
);
