# Google Calendar Reminder Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push medication doses and general reminders into each user's real Google Calendar via per-user OAuth, so Google's own notifications remind them.

**Architecture:** A dedicated Google OAuth consent flow (separate from Lovable-brokered login) stores an encrypted refresh token per user. A `fetch`-based service module writes/patches/deletes events on the resolved "holder" calendar. Sync fires on-write (best-effort, non-blocking) from existing mutations and is reconciled by a 15-minute apikey-verified pg_cron hook over a rolling 7-day window. Two new tables hold credentials and an idempotent source→event mapping.

**Tech Stack:** TanStack Start (React 19, SSR), TypeScript, Supabase/Postgres (Lovable Cloud), Cloudflare Worker runtime, Web Crypto (AES-GCM + HMAC), Vitest (new, for pure-function unit tests), Playwright (existing e2e).

**Spec:** `docs/superpowers/specs/2026-09-16-google-calendar-reminders-design.md`

## Global Constraints

- **Runtime is a Cloudflare Worker** — no Node-only packages (`child_process`, `fs`, `sharp`, `googleapis` SDK, etc.). Use `fetch` and Web Crypto only.
- **Server-fn split:** `*.functions.ts` files contain only imports, types, and exported `createServerFn` declarations. Runtime logic and all `process.env.*` reads live in `*.server.ts` modules, loaded via `await import(...)` inside `.handler()`.
- **Client-safe imports:** components import `*.functions.ts` only — never `*.server.ts`.
- **DB migrations:** every new `public` table gets `GRANT`s (to `authenticated`/`service_role`) + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policies **in the same migration**. Ownership via `user_id = auth.uid()`; family via `public.same_family_as()` / `public.is_family_adult_of()`; admin via `public.has_role(auth.uid(),'admin')`.
- **Never edit** auto-generated files under `src/integrations/supabase/` or `src/routeTree.gen.ts`.
- **Never expose** the service-role key or refresh tokens to the client. Token columns are read/written only via `supabaseAdmin` in `.server.ts`.
- **Routing:** TanStack Router only. Public hooks live under `src/routes/api/public/`.
- **Styling:** semantic design tokens only — no hardcoded color utilities (`text-white`, `bg-[#...]`). Brand is **SomeoneNear**.
- **New env vars (user sets in Lovable Cloud):** `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`, `CALENDAR_TOKEN_ENC_KEY`.

---

## File Structure

**New**
- `supabase/migrations/<ts>_google_calendar_sync.sql` — `google_calendar_credentials` + `calendar_event_links` tables, GRANTs, RLS, policies, indexes.
- `src/lib/calendar/crypto.server.ts` — AES-GCM encrypt/decrypt + HMAC state sign/verify (pure-ish, Web Crypto).
- `src/lib/calendar/events.ts` — **pure** functions: build event payloads from dose/reminder rows, compute `synced_hash`, diff desired vs existing. No I/O. (Unit-tested.)
- `src/lib/calendar/holder.ts` — **pure** holder-resolution function over pre-fetched inputs. No I/O. (Unit-tested.)
- `src/lib/calendar/google-api.server.ts` — `fetch` wrappers for Google token + Calendar v3 endpoints; network layer injectable.
- `src/lib/calendar/sync.server.ts` — orchestration: token refresh, holder resolution wiring, window materialization, create/patch/delete, `calendar_event_links` upkeep. Exposes `syncSourceItem(...)`, `runCalendarSyncWindow(...)`.
- `src/lib/google-calendar.functions.ts` — thin server-fn wrappers (`getGoogleCalendarStatus`, `startGoogleCalendarConnect`, `setCalendarSyncEnabled`, `disconnectGoogleCalendar`).
- `src/routes/api/public/google-calendar/callback.ts` — OAuth callback route.
- `src/routes/api/public/hooks/calendar-sync.ts` — apikey-verified cron hook.
- `src/components/google-calendar-card.tsx` — connect/disconnect UI.
- `src/lib/calendar/events.test.ts`, `src/lib/calendar/holder.test.ts` — Vitest unit tests.
- `vitest.config.ts` — test runner config.

**Modified**
- `src/lib/medications.functions.ts` — best-effort sync after `createMedication`, `logDose`, `deleteMedication`.
- `src/lib/reminders.functions.ts` — best-effort sync after `createReminder`, `completeReminder`, `deleteReminder`.
- `src/routes/_authenticated/reminders.tsx` — mount the card + `?calendar=` toast.
- `package.json` — add `vitest` + `test` script.
- `tests/e2e/smoke.spec.ts` — connect-card render assertion.

---

## Task 1: Add Vitest for pure-function unit tests

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/calendar/sanity.test.ts` (temporary, deleted in this task's last step)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` command running Vitest on `*.test.ts`.

- [ ] **Step 1: Add Vitest dev dependency**

Run:
```bash
npm install -D vitest@^2.1.9
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add the `test` script to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a temporary sanity test**

Create `src/lib/calendar/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test`
Expected: PASS, 1 test passed.

- [ ] **Step 6: Delete the sanity test and commit**

```bash
rm src/lib/calendar/sanity.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Database migration (credentials + event-link tables)

**Files:**
- Create: `supabase/migrations/<ts>_google_calendar_sync.sql` (use a timestamp later than the newest existing migration, e.g. `20260916120000_google_calendar_sync.sql`)

**Interfaces:**
- Consumes: existing `public.has_role(uuid, app_role)`, `public.set_updated_at()`.
- Produces: tables `public.google_calendar_credentials` and `public.calendar_event_links` with the columns other tasks read/write.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260916120000_google_calendar_sync.sql`:
```sql
-- =========================================================
-- GOOGLE CALENDAR SYNC: per-user OAuth credentials + event links
-- =========================================================

-- ---------- google_calendar_credentials ----------
CREATE TABLE public.google_calendar_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text,
  encrypted_refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.google_calendar_credentials TO authenticated;
GRANT ALL ON public.google_calendar_credentials TO service_role;
ALTER TABLE public.google_calendar_credentials ENABLE ROW LEVEL SECURITY;

-- Note: client never INSERTs; the OAuth callback writes via service_role.
-- SELECT is allowed but the client-facing server fn returns only non-secret columns.
CREATE POLICY "Users read their own calendar credential"
  ON public.google_calendar_credentials FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update their own calendar credential"
  ON public.google_calendar_credentials FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete their own calendar credential"
  ON public.google_calendar_credentials FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER google_calendar_credentials_set_updated_at
  BEFORE UPDATE ON public.google_calendar_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- calendar_event_links ----------
CREATE TABLE public.calendar_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('dose','reminder')),
  source_id uuid NOT NULL,
  google_event_id text NOT NULL,
  calendar_id text NOT NULL,
  synced_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_user_id, source_type, source_id)
);

-- Service-managed only: no direct client writes needed.
GRANT ALL ON public.calendar_event_links TO service_role;
ALTER TABLE public.calendar_event_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read event links"
  ON public.calendar_event_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER calendar_event_links_set_updated_at
  BEFORE UPDATE ON public.calendar_event_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_calendar_links_holder ON public.calendar_event_links(holder_user_id);
CREATE INDEX idx_calendar_links_source ON public.calendar_event_links(source_type, source_id);
```

- [ ] **Step 2: Apply the migration**

Apply via the project's Supabase/Lovable migration path (push migrations). Confirm both tables exist and RLS is enabled.
Expected: migration applies with no error; `google_calendar_credentials` and `calendar_event_links` present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260916120000_google_calendar_sync.sql
git commit -m "feat(db): google calendar credentials + event link tables"
```

---

## Task 3: Pure holder-resolution function (TDD)

**Files:**
- Create: `src/lib/calendar/holder.ts`
- Test: `src/lib/calendar/holder.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export type ConnectedHolder = { user_id: string; calendar_id: string };
export type FamilyAdultLink = { admin_user_id: string; member_user_id: string };
export function resolveHolder(input: {
  forUserId: string;
  connected: ConnectedHolder[];      // users with sync_enabled credentials
  familyAdults: FamilyAdultLink[];   // (admin, member) pairs where admin is owner/adult in member's family
}): ConnectedHolder | null;
```
Resolution order: family admin (owner/adult) connected → the `forUserId` person connected → `null`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar/holder.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveHolder } from "./holder";

const cal = (user_id: string, calendar_id = "primary") => ({ user_id, calendar_id });

describe("resolveHolder", () => {
  it("prefers a connected family admin over the person themselves", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("member"), cal("admin", "fam@x.com")],
      familyAdults: [{ admin_user_id: "admin", member_user_id: "member" }],
    });
    expect(r).toEqual({ user_id: "admin", calendar_id: "fam@x.com" });
  });

  it("falls back to the person's own calendar when no admin is connected", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("member")],
      familyAdults: [{ admin_user_id: "admin", member_user_id: "member" }],
    });
    expect(r).toEqual({ user_id: "member", calendar_id: "primary" });
  });

  it("returns null when nobody relevant is connected", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("stranger")],
      familyAdults: [],
    });
    expect(r).toBeNull();
  });

  it("ignores admins who are not connected", () => {
    const r = resolveHolder({
      forUserId: "member",
      connected: [cal("member")],
      familyAdults: [{ admin_user_id: "admin", member_user_id: "member" }],
    });
    expect(r).toEqual({ user_id: "member", calendar_id: "primary" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- holder`
Expected: FAIL — cannot find module `./holder` / `resolveHolder is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/calendar/holder.ts`:
```ts
export type ConnectedHolder = { user_id: string; calendar_id: string };
export type FamilyAdultLink = { admin_user_id: string; member_user_id: string };

export function resolveHolder(input: {
  forUserId: string;
  connected: ConnectedHolder[];
  familyAdults: FamilyAdultLink[];
}): ConnectedHolder | null {
  const connectedById = new Map(input.connected.map((c) => [c.user_id, c]));

  const adminLink = input.familyAdults.find(
    (l) => l.member_user_id === input.forUserId && connectedById.has(l.admin_user_id),
  );
  if (adminLink) return connectedById.get(adminLink.admin_user_id)!;

  return connectedById.get(input.forUserId) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- holder`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/holder.ts src/lib/calendar/holder.test.ts
git commit -m "feat(calendar): pure holder resolution"
```

---

## Task 4: Pure event-build + hash + diff (TDD)

**Files:**
- Create: `src/lib/calendar/events.ts`
- Test: `src/lib/calendar/events.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export type SourceType = "dose" | "reminder";

export type DesiredEvent = {
  source_type: SourceType;
  source_id: string;
  summary: string;
  description: string;
  start: string;   // ISO 8601
  end: string;     // ISO 8601
  hash: string;    // stable hash of summary+start+end
};

export type DoseRow = {
  id: string;
  scheduled_at: string;
  medication: { name: string; dosage: string | null; instructions: string | null };
};
export type ReminderRow = {
  id: string;
  due_at: string;
  title: string;
  description: string | null;
  category: string;
};

export function buildDoseEvent(row: DoseRow): DesiredEvent;
export function buildReminderEvent(row: ReminderRow): DesiredEvent;
export function stableHash(parts: string[]): string;

export type ExistingLink = { source_type: SourceType; source_id: string; synced_hash: string | null };
export type EventDiff = {
  toCreate: DesiredEvent[];
  toUpdate: DesiredEvent[];       // hash changed
  toDeleteKeys: { source_type: SourceType; source_id: string }[]; // link exists, no desired event
};
export function diffEvents(desired: DesiredEvent[], existing: ExistingLink[]): EventDiff;
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar/events.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  buildDoseEvent,
  buildReminderEvent,
  stableHash,
  diffEvents,
  type DesiredEvent,
} from "./events";

describe("stableHash", () => {
  it("is order-sensitive and deterministic", () => {
    expect(stableHash(["a", "b"])).toBe(stableHash(["a", "b"]));
    expect(stableHash(["a", "b"])).not.toBe(stableHash(["b", "a"]));
  });
});

describe("buildDoseEvent", () => {
  it("builds a 15-minute event with a medication title", () => {
    const e = buildDoseEvent({
      id: "d1",
      scheduled_at: "2026-09-16T09:00:00.000Z",
      medication: { name: "Metformin", dosage: "500 mg", instructions: "after food" },
    });
    expect(e.source_type).toBe("dose");
    expect(e.source_id).toBe("d1");
    expect(e.summary).toContain("Metformin");
    expect(e.summary).toContain("500 mg");
    expect(e.start).toBe("2026-09-16T09:00:00.000Z");
    expect(e.end).toBe("2026-09-16T09:15:00.000Z");
    expect(e.hash).toBe(stableHash([e.summary, e.start, e.end]));
  });
});

describe("buildReminderEvent", () => {
  it("uses the reminder title and a 30-minute default block", () => {
    const e = buildReminderEvent({
      id: "r1",
      due_at: "2026-09-16T14:00:00.000Z",
      title: "Pay electricity bill",
      description: null,
      category: "bill",
    });
    expect(e.source_type).toBe("reminder");
    expect(e.summary).toBe("Pay electricity bill");
    expect(e.start).toBe("2026-09-16T14:00:00.000Z");
    expect(e.end).toBe("2026-09-16T14:30:00.000Z");
  });
});

describe("diffEvents", () => {
  const ev = (id: string, hash: string): DesiredEvent => ({
    source_type: "reminder",
    source_id: id,
    summary: "x",
    description: "",
    start: "2026-09-16T14:00:00.000Z",
    end: "2026-09-16T14:30:00.000Z",
    hash,
  });

  it("creates when no link exists", () => {
    const d = diffEvents([ev("r1", "h1")], []);
    expect(d.toCreate.map((e) => e.source_id)).toEqual(["r1"]);
    expect(d.toUpdate).toEqual([]);
    expect(d.toDeleteKeys).toEqual([]);
  });

  it("updates when the hash changed", () => {
    const d = diffEvents([ev("r1", "h2")], [{ source_type: "reminder", source_id: "r1", synced_hash: "h1" }]);
    expect(d.toUpdate.map((e) => e.source_id)).toEqual(["r1"]);
    expect(d.toCreate).toEqual([]);
  });

  it("skips when the hash matches", () => {
    const d = diffEvents([ev("r1", "h1")], [{ source_type: "reminder", source_id: "r1", synced_hash: "h1" }]);
    expect(d.toCreate).toEqual([]);
    expect(d.toUpdate).toEqual([]);
    expect(d.toDeleteKeys).toEqual([]);
  });

  it("deletes when a link has no desired event", () => {
    const d = diffEvents([], [{ source_type: "reminder", source_id: "r1", synced_hash: "h1" }]);
    expect(d.toDeleteKeys).toEqual([{ source_type: "reminder", source_id: "r1" }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- events`
Expected: FAIL — cannot find module `./events`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/calendar/events.ts`:
```ts
export type SourceType = "dose" | "reminder";

export type DesiredEvent = {
  source_type: SourceType;
  source_id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  hash: string;
};

export type DoseRow = {
  id: string;
  scheduled_at: string;
  medication: { name: string; dosage: string | null; instructions: string | null };
};
export type ReminderRow = {
  id: string;
  due_at: string;
  title: string;
  description: string | null;
  category: string;
};

// Small, dependency-free FNV-1a hash rendered as hex. Stable across runs.
export function stableHash(parts: string[]): string {
  const str = parts.join("\u0000");
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function buildDoseEvent(row: DoseRow): DesiredEvent {
  const dosage = row.medication.dosage ? ` (${row.medication.dosage})` : "";
  const summary = `\u{1F48A} Take ${row.medication.name}${dosage}`;
  const description = row.medication.instructions ?? "";
  const start = new Date(row.scheduled_at).toISOString();
  const end = addMinutes(start, 15);
  return {
    source_type: "dose",
    source_id: row.id,
    summary,
    description,
    start,
    end,
    hash: stableHash([summary, start, end]),
  };
}

export function buildReminderEvent(row: ReminderRow): DesiredEvent {
  const summary = row.title;
  const description = row.description ?? "";
  const start = new Date(row.due_at).toISOString();
  const end = addMinutes(start, 30);
  return {
    source_type: "reminder",
    source_id: row.id,
    summary,
    description,
    start,
    end,
    hash: stableHash([summary, start, end]),
  };
}

export type ExistingLink = { source_type: SourceType; source_id: string; synced_hash: string | null };
export type EventDiff = {
  toCreate: DesiredEvent[];
  toUpdate: DesiredEvent[];
  toDeleteKeys: { source_type: SourceType; source_id: string }[];
};

const key = (t: SourceType, id: string) => `${t}:${id}`;

export function diffEvents(desired: DesiredEvent[], existing: ExistingLink[]): EventDiff {
  const existingByKey = new Map(existing.map((e) => [key(e.source_type, e.source_id), e]));
  const desiredKeys = new Set(desired.map((e) => key(e.source_type, e.source_id)));

  const toCreate: DesiredEvent[] = [];
  const toUpdate: DesiredEvent[] = [];
  for (const e of desired) {
    const prev = existingByKey.get(key(e.source_type, e.source_id));
    if (!prev) toCreate.push(e);
    else if (prev.synced_hash !== e.hash) toUpdate.push(e);
  }

  const toDeleteKeys = existing
    .filter((l) => !desiredKeys.has(key(l.source_type, l.source_id)))
    .map((l) => ({ source_type: l.source_type, source_id: l.source_id }));

  return { toCreate, toUpdate, toDeleteKeys };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- events`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/events.ts src/lib/calendar/events.test.ts
git commit -m "feat(calendar): pure event build, hash, and diff"
```

---

## Task 5: Crypto + state signing (Web Crypto)

**Files:**
- Create: `src/lib/calendar/crypto.server.ts`
- Test: `src/lib/calendar/crypto.test.ts`

**Interfaces:**
- Consumes: `process.env.CALENDAR_TOKEN_ENC_KEY` (read by callers and passed in — functions take the key as an argument so they stay testable and never read env at module scope).
- Produces:
```ts
export function encryptSecret(plaintext: string, keyMaterial: string): Promise<string>; // "iv.ciphertext" base64url
export function decryptSecret(payload: string, keyMaterial: string): Promise<string>;
export function signState(payload: object, keyMaterial: string, ttlMs?: number): Promise<string>;
export function verifyState(token: string, keyMaterial: string): Promise<Record<string, unknown> | null>; // null if bad/expired
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/calendar/crypto.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, signState, verifyState } from "./crypto.server";

const KEY = "test-key-please-change-32bytes-long!!";

describe("encryptSecret/decryptSecret", () => {
  it("round-trips a secret", async () => {
    const enc = await encryptSecret("refresh-token-123", KEY);
    expect(enc).not.toContain("refresh-token-123");
    expect(await decryptSecret(enc, KEY)).toBe("refresh-token-123");
  });

  it("fails to decrypt with the wrong key", async () => {
    const enc = await encryptSecret("secret", KEY);
    await expect(decryptSecret(enc, "different-key-different-key-32b!!")).rejects.toBeTruthy();
  });
});

describe("signState/verifyState", () => {
  it("round-trips a payload", async () => {
    const token = await signState({ userId: "u1" }, KEY, 60_000);
    const out = await verifyState(token, KEY);
    expect(out?.userId).toBe("u1");
  });

  it("rejects a tampered token", async () => {
    const token = await signState({ userId: "u1" }, KEY, 60_000);
    expect(await verifyState(token + "x", KEY)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signState({ userId: "u1" }, KEY, -1);
    expect(await verifyState(token, KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- crypto`
Expected: FAIL — cannot find module `./crypto.server`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calendar/crypto.server.ts`:
```ts
// Web Crypto only (Cloudflare Worker safe). No Node APIs.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(keyMaterial: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(keyMaterial));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string, keyMaterial: string): Promise<string> {
  const key = await aesKey(keyMaterial);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)),
  );
  return `${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function decryptSecret(payload: string, keyMaterial: string): Promise<string> {
  const [ivPart, ctPart] = payload.split(".");
  if (!ivPart || !ctPart) throw new Error("Malformed ciphertext");
  const key = await aesKey(keyMaterial);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64urlDecode(ivPart) },
    key,
    b64urlDecode(ctPart),
  );
  return dec.decode(pt);
}

async function hmacKey(keyMaterial: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(payload: object, keyMaterial: string, ttlMs = 600_000): Promise<string> {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const bodyB64 = b64urlEncode(enc.encode(JSON.stringify(body)));
  const key = await hmacKey(keyMaterial);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(bodyB64)));
  return `${bodyB64}.${b64urlEncode(sig)}`;
}

export async function verifyState(token: string, keyMaterial: string): Promise<Record<string, unknown> | null> {
  const [bodyB64, sigB64] = token.split(".");
  if (!bodyB64 || !sigB64) return null;
  const key = await hmacKey(keyMaterial);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), enc.encode(bodyB64));
  if (!ok) return null;
  try {
    const body = JSON.parse(dec.decode(b64urlDecode(bodyB64))) as Record<string, unknown>;
    if (typeof body.exp === "number" && body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- crypto`
Expected: PASS (Vitest node environment provides `crypto.subtle`, `btoa`, `atob` on Node 20+; the repo targets Node types ^22).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/crypto.server.ts src/lib/calendar/crypto.test.ts
git commit -m "feat(calendar): web-crypto secret encryption and signed state"
```

---

## Task 6: Google API client (token exchange/refresh + Calendar v3)

**Files:**
- Create: `src/lib/calendar/google-api.server.ts`

**Interfaces:**
- Consumes: nothing at module scope (all inputs passed as args; `fetch` global).
- Produces:
```ts
export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};
export function buildConsentUrl(args: {
  clientId: string; redirectUri: string; state: string;
}): string;
export function exchangeCode(args: {
  code: string; clientId: string; clientSecret: string; redirectUri: string;
}): Promise<GoogleTokens>;
export function refreshAccessToken(args: {
  refreshToken: string; clientId: string; clientSecret: string;
}): Promise<GoogleTokens>;
export function fetchUserEmail(accessToken: string): Promise<string | null>;
export function insertEvent(args: {
  accessToken: string; calendarId: string;
  event: { summary: string; description: string; start: string; end: string };
}): Promise<{ id: string }>;
export function patchEvent(args: {
  accessToken: string; calendarId: string; eventId: string;
  event: { summary: string; description: string; start: string; end: string };
}): Promise<void>;
export function deleteEvent(args: {
  accessToken: string; calendarId: string; eventId: string;
}): Promise<void>;
```

- [ ] **Step 1: Write the implementation**

Create `src/lib/calendar/google-api.server.ts`:
```ts
export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

export function buildConsentUrl(args: { clientId: string; redirectUri: string; state: string }): string {
  const p = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: `${CALENDAR_SCOPE} ${USERINFO_SCOPE}`,
    state: args.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google token error ${res.status}: ${t.slice(0, 240)}`);
  }
  return (await res.json()) as GoogleTokens;
}

export function exchangeCode(args: {
  code: string; clientId: string; clientSecret: string; redirectUri: string;
}): Promise<GoogleTokens> {
  return tokenRequest(
    new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

export function refreshAccessToken(args: {
  refreshToken: string; clientId: string; clientSecret: string;
}): Promise<GoogleTokens> {
  return tokenRequest(
    new URLSearchParams({
      refresh_token: args.refreshToken,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { email?: string };
  return j.email ?? null;
}

function eventBody(event: { summary: string; description: string; start: string; end: string }) {
  return {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
    reminders: { useDefault: true },
  };
}

function calUrl(calendarId: string, suffix = ""): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${suffix}`;
}

export async function insertEvent(args: {
  accessToken: string; calendarId: string;
  event: { summary: string; description: string; start: string; end: string };
}): Promise<{ id: string }> {
  const res = await fetch(calUrl(args.calendarId), {
    method: "POST",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody(args.event)),
  });
  if (!res.ok) throw new Error(`Calendar insert ${res.status}: ${(await res.text()).slice(0, 240)}`);
  const j = (await res.json()) as { id: string };
  return { id: j.id };
}

export async function patchEvent(args: {
  accessToken: string; calendarId: string; eventId: string;
  event: { summary: string; description: string; start: string; end: string };
}): Promise<void> {
  const res = await fetch(`${calUrl(args.calendarId, "/")}${encodeURIComponent(args.eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${args.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody(args.event)),
  });
  if (!res.ok) throw new Error(`Calendar patch ${res.status}: ${(await res.text()).slice(0, 240)}`);
}

export async function deleteEvent(args: {
  accessToken: string; calendarId: string; eventId: string;
}): Promise<void> {
  const res = await fetch(`${calUrl(args.calendarId, "/")}${encodeURIComponent(args.eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  // 404/410 mean the event is already gone — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar delete ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new type errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendar/google-api.server.ts
git commit -m "feat(calendar): fetch-based google token + calendar v3 client"
```

---

## Task 7: Sync orchestration module

**Files:**
- Create: `src/lib/calendar/sync.server.ts`

**Interfaces:**
- Consumes: `resolveHolder` (Task 3); `buildDoseEvent`, `buildReminderEvent`, `diffEvents`, `DesiredEvent`, `ExistingLink` (Task 4); `decryptSecret`, `encryptSecret` (Task 5); `refreshAccessToken`, `insertEvent`, `patchEvent`, `deleteEvent` (Task 6); `supabaseAdmin` from `@/integrations/supabase/client.server`.
- Produces:
```ts
export function getFreshAccessToken(holderUserId: string): Promise<{ accessToken: string; calendarId: string } | null>;
export function runCalendarSyncWindow(opts?: { windowDays?: number }): Promise<{ holders: number; created: number; updated: number; deleted: number }>;
export function syncNow(): Promise<void>; // fire-and-forget wrapper used by on-write hooks
```

- [ ] **Step 1: Write the module**

Create `src/lib/calendar/sync.server.ts`:
```ts
import { resolveHolder, type ConnectedHolder, type FamilyAdultLink } from "./holder";
import {
  buildDoseEvent, buildReminderEvent, diffEvents,
  type DesiredEvent, type ExistingLink,
} from "./events";
import { decryptSecret } from "./crypto.server";
import { refreshAccessToken, insertEvent, patchEvent, deleteEvent } from "./google-api.server";

const WINDOW_DAYS_DEFAULT = 7;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Return a valid access token for a holder, refreshing if needed. null if not connected/enabled.
export async function getFreshAccessToken(
  holderUserId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cred } = await supabaseAdmin
    .from("google_calendar_credentials")
    .select("*")
    .eq("user_id", holderUserId)
    .maybeSingle();
  if (!cred || !cred.sync_enabled) return null;

  const notExpired =
    cred.access_token &&
    cred.access_token_expires_at &&
    new Date(cred.access_token_expires_at).getTime() > Date.now() + 60_000;
  if (notExpired) return { accessToken: cred.access_token as string, calendarId: cred.calendar_id };

  const refreshToken = await decryptSecret(cred.encrypted_refresh_token, env("CALENDAR_TOKEN_ENC_KEY"));
  const tokens = await refreshAccessToken({
    refreshToken,
    clientId: env("GOOGLE_CALENDAR_CLIENT_ID"),
    clientSecret: env("GOOGLE_CALENDAR_CLIENT_SECRET"),
  });
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("google_calendar_credentials")
    .update({ access_token: tokens.access_token, access_token_expires_at: expiresAt })
    .eq("user_id", holderUserId);
  return { accessToken: tokens.access_token, calendarId: cred.calendar_id };
}

type SourceKey = { source_type: "dose" | "reminder"; source_id: string };

// Load connected holders and family-admin links for holder resolution.
async function loadResolutionInputs(supabaseAdmin: any): Promise<{
  connected: ConnectedHolder[];
  familyAdults: FamilyAdultLink[];
}> {
  const { data: creds } = await supabaseAdmin
    .from("google_calendar_credentials")
    .select("user_id, calendar_id, sync_enabled")
    .eq("sync_enabled", true);
  const connected: ConnectedHolder[] = (creds ?? []).map((c: any) => ({
    user_id: c.user_id,
    calendar_id: c.calendar_id,
  }));

  // Build (admin, member) links from family_members: owners/adults are admins over every member.
  const { data: fm } = await supabaseAdmin
    .from("family_members")
    .select("family_id, user_id, role");
  const byFamily = new Map<string, { user_id: string; role: string }[]>();
  for (const row of fm ?? []) {
    const list = byFamily.get(row.family_id) ?? [];
    list.push({ user_id: row.user_id, role: row.role });
    byFamily.set(row.family_id, list);
  }
  const familyAdults: FamilyAdultLink[] = [];
  for (const members of byFamily.values()) {
    const admins = members.filter((m) => m.role === "owner" || m.role === "adult");
    for (const a of admins) {
      for (const m of members) {
        if (m.user_id !== a.user_id) {
          familyAdults.push({ admin_user_id: a.user_id, member_user_id: m.user_id });
        }
      }
    }
  }
  return { connected, familyAdults };
}

export async function runCalendarSyncWindow(
  opts?: { windowDays?: number },
): Promise<{ holders: number; created: number; updated: number; deleted: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const windowDays = opts?.windowDays ?? WINDOW_DAYS_DEFAULT;
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { connected, familyAdults } = await loadResolutionInputs(supabaseAdmin);
  if (connected.length === 0) return { holders: 0, created: 0, updated: 0, deleted: 0 };

  // Gather desired events per holder.
  const desiredByHolder = new Map<string, DesiredEvent[]>();
  const calendarByHolder = new Map<string, string>();
  for (const c of connected) calendarByHolder.set(c.user_id, c.calendar_id);

  // Doses in window (join medication for title/instructions + for_user_id).
  const { data: doses } = await supabaseAdmin
    .from("dose_logs")
    .select("id, scheduled_at, medications(name, dosage, instructions, for_user_id)")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon);
  for (const d of doses ?? []) {
    const forUser = d.medications?.for_user_id;
    if (!forUser) continue;
    const holder = resolveHolder({ forUserId: forUser, connected, familyAdults });
    if (!holder) continue;
    const ev = buildDoseEvent({
      id: d.id,
      scheduled_at: d.scheduled_at,
      medication: {
        name: d.medications.name,
        dosage: d.medications.dosage ?? null,
        instructions: d.medications.instructions ?? null,
      },
    });
    const list = desiredByHolder.get(holder.user_id) ?? [];
    list.push(ev);
    desiredByHolder.set(holder.user_id, list);
  }

  // Reminders in window (pending/snoozed only).
  const { data: reminders } = await supabaseAdmin
    .from("reminders")
    .select("id, due_at, title, description, category, for_user_id, status")
    .in("status", ["pending", "snoozed"])
    .gte("due_at", now.toISOString())
    .lte("due_at", horizon);
  for (const r of reminders ?? []) {
    const holder = resolveHolder({ forUserId: r.for_user_id, connected, familyAdults });
    if (!holder) continue;
    const ev = buildReminderEvent({
      id: r.id,
      due_at: r.due_at,
      title: r.title,
      description: r.description ?? null,
      category: r.category,
    });
    const list = desiredByHolder.get(holder.user_id) ?? [];
    list.push(ev);
    desiredByHolder.set(holder.user_id, list);
  }

  let created = 0, updated = 0, deleted = 0;

  for (const [holderUserId, desired] of desiredByHolder) {
    // Existing links for this holder, scoped to the source ids in play OR any link past due (for cleanup).
    const { data: links } = await supabaseAdmin
      .from("calendar_event_links")
      .select("source_type, source_id, google_event_id, synced_hash")
      .eq("holder_user_id", holderUserId);
    const existing: ExistingLink[] = (links ?? []).map((l: any) => ({
      source_type: l.source_type, source_id: l.source_id, synced_hash: l.synced_hash,
    }));
    const eventIdByKey = new Map<string, string>(
      (links ?? []).map((l: any) => [`${l.source_type}:${l.source_id}`, l.google_event_id]),
    );

    const diff = diffEvents(desired, existing);
    if (diff.toCreate.length === 0 && diff.toUpdate.length === 0 && diff.toDeleteKeys.length === 0) continue;

    const token = await getFreshAccessToken(holderUserId);
    if (!token) continue;

    for (const e of diff.toCreate) {
      try {
        const res = await insertEvent({
          accessToken: token.accessToken, calendarId: token.calendarId,
          event: { summary: e.summary, description: e.description, start: e.start, end: e.end },
        });
        await supabaseAdmin.from("calendar_event_links").upsert({
          holder_user_id: holderUserId, source_type: e.source_type, source_id: e.source_id,
          google_event_id: res.id, calendar_id: token.calendarId, synced_hash: e.hash,
        }, { onConflict: "holder_user_id,source_type,source_id" });
        created++;
      } catch (err) { console.error("[calendar-sync] create failed", err); }
    }
    for (const e of diff.toUpdate) {
      const eventId = eventIdByKey.get(`${e.source_type}:${e.source_id}`);
      if (!eventId) continue;
      try {
        await patchEvent({
          accessToken: token.accessToken, calendarId: token.calendarId, eventId,
          event: { summary: e.summary, description: e.description, start: e.start, end: e.end },
        });
        await supabaseAdmin.from("calendar_event_links")
          .update({ synced_hash: e.hash })
          .eq("holder_user_id", holderUserId).eq("source_type", e.source_type).eq("source_id", e.source_id);
        updated++;
      } catch (err) { console.error("[calendar-sync] patch failed", err); }
    }
    for (const k of diff.toDeleteKeys) {
      const eventId = eventIdByKey.get(`${k.source_type}:${k.source_id}`);
      if (!eventId) continue;
      try {
        await deleteEvent({ accessToken: token.accessToken, calendarId: token.calendarId, eventId });
        await supabaseAdmin.from("calendar_event_links")
          .delete()
          .eq("holder_user_id", holderUserId).eq("source_type", k.source_type).eq("source_id", k.source_id);
        deleted++;
      } catch (err) { console.error("[calendar-sync] delete failed", err); }
    }

    await supabaseAdmin.from("google_calendar_credentials")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", holderUserId);
  }

  return { holders: desiredByHolder.size, created, updated, deleted };
}

// Fire-and-forget wrapper for on-write hooks. Never throws.
export async function syncNow(): Promise<void> {
  try {
    await runCalendarSyncWindow();
  } catch (err) {
    console.error("[calendar-sync] syncNow failed", err);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new type errors. (The `any` on Supabase rows mirrors the existing `seedDoseLogs` pattern in `medications.functions.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendar/sync.server.ts
git commit -m "feat(calendar): sync orchestration over rolling window"
```

---

## Task 8: Server-fn wrappers (connect / status / toggle / disconnect)

**Files:**
- Create: `src/lib/google-calendar.functions.ts`

**Interfaces:**
- Consumes: `requireSupabaseAuth`; Task 5 (`signState`), Task 6 (`buildConsentUrl`); `supabaseAdmin`.
- Produces:
```ts
export const getGoogleCalendarStatus; // GET -> { connected, google_email, sync_enabled, calendar_id, last_synced_at } | { connected: false }
export const startGoogleCalendarConnect; // POST -> { url }
export const setCalendarSyncEnabled;     // POST { enabled } -> { ok }
export const disconnectGoogleCalendar;   // POST -> { ok }
```

- [ ] **Step 1: Write the wrappers**

Create `src/lib/google-calendar.functions.ts`:
```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("google_calendar_credentials")
      .select("google_email, sync_enabled, calendar_id, last_synced_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { connected: false as const };
    return {
      connected: true as const,
      google_email: data.google_email,
      sync_enabled: data.sync_enabled,
      calendar_id: data.calendar_id,
      last_synced_at: data.last_synced_at,
    };
  });

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { signState } = await import("@/lib/calendar/crypto.server");
    const { buildConsentUrl } = await import("@/lib/calendar/google-api.server");
    const encKey = process.env["CALENDAR_TOKEN_ENC_KEY"];
    const clientId = process.env["GOOGLE_CALENDAR_CLIENT_ID"];
    const redirectUri = process.env["GOOGLE_CALENDAR_REDIRECT_URI"];
    if (!encKey || !clientId || !redirectUri) {
      throw new Error("Google Calendar is not configured on the server yet.");
    }
    const state = await signState({ userId: context.userId }, encKey, 600_000);
    return { url: buildConsentUrl({ clientId, redirectUri, state }) };
  });

export const setCalendarSyncEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("google_calendar_credentials")
      .update({ sync_enabled: data.enabled })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("google_calendar_credentials")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/google-calendar.functions.ts
git commit -m "feat(calendar): server-fn wrappers for connect/status/toggle/disconnect"
```

---

## Task 9: OAuth callback route

**Files:**
- Create: `src/routes/api/public/google-calendar/callback.ts`

**Interfaces:**
- Consumes: Task 5 (`verifyState`, `encryptSecret`), Task 6 (`exchangeCode`, `fetchUserEmail`), `supabaseAdmin`.
- Produces: an HTTP GET route Google redirects to; upserts the credential row; 302-redirects to `/reminders?calendar=connected|error`.

- [ ] **Step 1: Write the route**

Create `src/routes/api/public/google-calendar/callback.ts`:
```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google-calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const appError = url.searchParams.get("error");

        const redirect = (status: "connected" | "error") =>
          new Response(null, { status: 302, headers: { Location: `/reminders?calendar=${status}` } });

        if (appError || !code || !state) return redirect("error");

        try {
          const encKey = process.env["CALENDAR_TOKEN_ENC_KEY"];
          const clientId = process.env["GOOGLE_CALENDAR_CLIENT_ID"];
          const clientSecret = process.env["GOOGLE_CALENDAR_CLIENT_SECRET"];
          const redirectUri = process.env["GOOGLE_CALENDAR_REDIRECT_URI"];
          if (!encKey || !clientId || !clientSecret || !redirectUri) return redirect("error");

          const { verifyState, encryptSecret } = await import("@/lib/calendar/crypto.server");
          const { exchangeCode, fetchUserEmail } = await import("@/lib/calendar/google-api.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const claims = await verifyState(state, encKey);
          const userId = claims?.userId;
          if (!userId || typeof userId !== "string") return redirect("error");

          const tokens = await exchangeCode({ code, clientId, clientSecret, redirectUri });
          if (!tokens.refresh_token) return redirect("error"); // no offline grant -> cannot sync later

          const email = await fetchUserEmail(tokens.access_token);
          const encrypted = await encryptSecret(tokens.refresh_token, encKey);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { error } = await supabaseAdmin
            .from("google_calendar_credentials")
            .upsert(
              {
                user_id: userId,
                google_email: email,
                encrypted_refresh_token: encrypted,
                access_token: tokens.access_token,
                access_token_expires_at: expiresAt,
                scope: tokens.scope ?? null,
                calendar_id: "primary",
                sync_enabled: true,
              },
              { onConflict: "user_id" },
            );
          if (error) return redirect("error");

          return redirect("connected");
        } catch (e) {
          console.error("[google-calendar callback] failed", e);
          return redirect("error");
        }
      },
    },
  },
});
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit`
Expected: no new type errors. (Route tree regenerates on `vite dev`/`build`; do not hand-edit `routeTree.gen.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/public/google-calendar/callback.ts
git commit -m "feat(calendar): oauth callback route stores encrypted refresh token"
```

---

## Task 10: Cron sync hook

**Files:**
- Create: `src/routes/api/public/hooks/calendar-sync.ts`

**Interfaces:**
- Consumes: Task 7 (`runCalendarSyncWindow`).
- Produces: apikey-verified POST hook returning the sync counts. Mirrors `call-sla.ts`.

- [ ] **Step 1: Write the hook (mirrors call-sla.ts auth)**

Create `src/routes/api/public/hooks/calendar-sync.ts`:
```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/calendar-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!key || !expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { runCalendarSyncWindow } = await import("@/lib/calendar/sync.server");
          const result = await runCalendarSyncWindow();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("calendar-sync hook failed", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
```

- [ ] **Step 2: Register the pg_cron schedule (migration)**

Create `supabase/migrations/20260916120500_calendar_sync_cron.sql`. Use the same `net.http_post` + `cron.schedule` shape as the existing `call-sla` cron in this repo (copy the SLA cron migration and adapt URL + name). The request URL is the deployed origin + `/api/public/hooks/calendar-sync`, header `apikey` = the anon key.
```sql
-- Every 15 minutes: reconcile the rolling 7-day window into Google Calendars.
select cron.schedule(
  'calendar-sync-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.site_url', true) || '/api/public/hooks/calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.settings.anon_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```
NOTE: if this repo's existing SLA cron uses hardcoded URL/key settings instead of `current_setting(...)`, match that exact convention instead — check the newest `*_cron*.sql` migration before writing this file.

- [ ] **Step 3: Apply and smoke-test the hook**

Apply the migration. Then verify the endpoint auth path locally: a POST without the apikey returns 401; a POST with the correct apikey returns `{ ok: true, ... }`.
Run (adjust host/key): `curl -s -X POST "$SITE_URL/api/public/hooks/calendar-sync" -H "apikey: $ANON_KEY"`
Expected: JSON `{ "ok": true, "holders": ..., "created": ..., "updated": ..., "deleted": ... }`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/public/hooks/calendar-sync.ts supabase/migrations/20260916120500_calendar_sync_cron.sql
git commit -m "feat(calendar): cron hook + schedule for 15-min sync"
```

---

## Task 11: On-write sync hooks in existing mutations

**Files:**
- Modify: `src/lib/medications.functions.ts` (in `createMedication`, `logDose`, `deleteMedication`)
- Modify: `src/lib/reminders.functions.ts` (in `createReminder`, `completeReminder`, `deleteReminder`)

**Interfaces:**
- Consumes: Task 7 (`syncNow`).
- Produces: no new exports; each mutation triggers a best-effort sync after its DB write.

- [ ] **Step 1: Add the helper call to `createReminder` (reminders.functions.ts)**

In `createReminder`'s `.handler`, after the existing success (`return row;`), replace the tail so the sync runs before returning:
```ts
    if (error) throw new Error(error.message);
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] createReminder", e);
    }
    return row;
```

- [ ] **Step 2: Add the same block to `completeReminder` and `deleteReminder`**

In each, immediately after `if (error) throw new Error(error.message);` and before `return { ok: true };`:
```ts
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] reminder mutation", e);
    }
```

- [ ] **Step 3: Add the same block to `createMedication`, `logDose`, `deleteMedication` (medications.functions.ts)**

In `createMedication`, after `await seedDoseLogs(context.supabase, row.id);` and before `return row;`:
```ts
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] createMedication", e);
    }
```
In `logDose` and `deleteMedication`, after `if (error) throw new Error(error.message);` and before `return { ok: true };`:
```ts
    try {
      const { syncNow } = await import("@/lib/calendar/sync.server");
      await syncNow();
    } catch (e) {
      console.error("[calendar-sync] medication mutation", e);
    }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/medications.functions.ts src/lib/reminders.functions.ts
git commit -m "feat(calendar): best-effort on-write sync from reminder/medication mutations"
```

---

## Task 12: Connect/disconnect UI card

**Files:**
- Create: `src/components/google-calendar-card.tsx`

**Interfaces:**
- Consumes: Task 8 server fns; `useServerFn`, `useQuery`, existing UI primitives (`Switch`, `Button`) and `sonner` `toast`.
- Produces: `<GoogleCalendarCard />` default/named export mounted in Task 13.

- [ ] **Step 1: Write the component**

Create `src/components/google-calendar-card.tsx`:
```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import {
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
  setCalendarSyncEnabled,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function GoogleCalendarCard() {
  const qc = useQueryClient();
  const status = useServerFn(getGoogleCalendarStatus);
  const start = useServerFn(startGoogleCalendarConnect);
  const toggle = useServerFn(setCalendarSyncEnabled);
  const disconnect = useServerFn(disconnectGoogleCalendar);

  const q = useQuery({ queryKey: ["google-calendar-status"], queryFn: () => status({}) });
  const data = q.data;

  const onConnect = async () => {
    try {
      const { url } = await start({});
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start Google Calendar connection.");
    }
  };

  return (
    <div className="rounded-brand border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-primary">
          {data?.connected ? <CalendarCheck className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Google Calendar</p>
          {!data?.connected ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your Google Calendar so medication and reminder times show up with Google's own alerts.
              </p>
              <Button className="mt-3" size="sm" onClick={onConnect}>
                Connect Google Calendar
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Connected as {data.google_email ?? "your Google account"}. Reminders for your family appear here.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Switch
                  checked={data.sync_enabled}
                  onCheckedChange={async (v) => {
                    await toggle({ data: { enabled: v } });
                    qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
                  }}
                  aria-label="Toggle Google Calendar sync"
                />
                <span className="text-sm text-muted-foreground">Syncing {data.sync_enabled ? "on" : "off"}</span>
              </div>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await disconnect({});
                  qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
                  toast.success("Google Calendar disconnected.");
                }}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new type errors. If `Switch` or `Button` import paths differ, match the paths used elsewhere in `src/components/ui/`.

- [ ] **Step 3: Commit**

```bash
git add src/components/google-calendar-card.tsx
git commit -m "feat(calendar): connect/disconnect card component"
```

---

## Task 13: Mount card + callback toast on the reminders page

**Files:**
- Modify: `src/routes/_authenticated/reminders.tsx`

**Interfaces:**
- Consumes: Task 12 (`GoogleCalendarCard`).
- Produces: the card is visible on the reminders page; a `?calendar=connected|error` query param shows a Sonner toast once and is cleared from the URL.

- [ ] **Step 1: Read the current reminders route to find the render body and imports**

Run: open `src/routes/_authenticated/reminders.tsx`. Identify the top of the page's returned JSX (where the header/first section renders) and the existing import block.

- [ ] **Step 2: Import and render the card**

Add to the imports:
```tsx
import { GoogleCalendarCard } from "@/components/google-calendar-card";
```
Render `<GoogleCalendarCard />` near the top of the page content (e.g. just under the page header, before the reminders list). Match the surrounding layout wrappers/spacing already used on the page.

- [ ] **Step 3: Show the callback toast once**

Add an effect in the route component (uses `sonner` `toast`; read the `calendar` search param via the router's `useSearch` for this route, or `new URLSearchParams(window.location.search)` inside a `useEffect`). Minimal window-based version:
```tsx
import { useEffect } from "react";
import { toast } from "sonner";

// inside the component body:
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const flag = params.get("calendar");
  if (flag === "connected") toast.success("Google Calendar connected. Your reminders will sync.");
  else if (flag === "error") toast.error("We couldn't connect Google Calendar. Please try again.");
  if (flag) {
    params.delete("calendar");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }
}, []);
```
If the file already imports `useEffect`/`toast`, don't duplicate the imports.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_authenticated/reminders.tsx
git commit -m "feat(calendar): mount connect card + callback toast on reminders page"
```

---

## Task 14: E2E smoke assertion + full verification

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: the reminders page rendering `GoogleCalendarCard`.
- Produces: a smoke assertion that the connect card renders.

- [ ] **Step 1: Read the existing smoke test to match its auth/navigation helpers**

Run: open `tests/e2e/smoke.spec.ts`. Reuse whatever login/navigation setup it already uses to reach an authenticated page.

- [ ] **Step 2: Add a card-render assertion**

Add a test that navigates to `/reminders` (using the file's existing auth helper) and asserts the card is visible:
```ts
test("reminders page shows the Google Calendar connect card", async ({ page }) => {
  // reuse the file's existing sign-in/navigation helper to reach /reminders
  await page.goto("/reminders");
  await expect(page.getByText("Google Calendar")).toBeVisible();
});
```
If the smoke test cannot authenticate in CI, guard/skip consistently with the other tests in the file rather than adding a flaky unauthenticated navigation.

- [ ] **Step 3: Run the unit suite**

Run: `npm test`
Expected: PASS — holder, events, crypto suites green.

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm run build`
Expected: all succeed with no new errors.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(calendar): smoke assertion for connect card"
```

---

## Manual setup (user-owned, documented here for handoff)

These are prerequisites for the feature to work with real users; they are not code tasks:

1. **Google Cloud Console:** create an OAuth 2.0 Client (Web application). Add the authorized redirect URI matching `GOOGLE_CALENDAR_REDIRECT_URI` (e.g. `https://<domain>/api/public/google-calendar/callback`). Enable the **Google Calendar API**.
2. **OAuth consent screen:** add scopes `.../auth/calendar.events` and `.../auth/userinfo.email`. While unverified, add test users. Submit for **verification** before general availability (the `calendar.events` scope is sensitive).
3. **Env vars in Lovable Cloud:** set `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`, and a strong random `CALENDAR_TOKEN_ENC_KEY`.
4. **pg_cron/pg_net settings:** ensure the site URL + anon key used by the cron migration match the deployment (mirror the existing SLA cron's configuration).

---

## Self-Review

**Spec coverage:**
- Per-user OAuth (offline, encrypted refresh token) → Tasks 5, 6, 9. ✅
- Two tables with GRANTs/RLS/policies in one migration → Task 2. ✅
- Fetch-based Google client, no Node SDK → Task 6. ✅
- Holder resolution (admin → self → none) → Task 3 + wired in Task 7. ✅
- Doses + reminders become events; 15-min dose / titles → Task 4. ✅
- On-write (best-effort, non-blocking) → Task 11. ✅
- 15-min cron over rolling 7-day window → Tasks 7, 10. ✅
- Idempotency via UNIQUE + synced_hash → Tasks 2, 4, 7. ✅
- UI connect/disconnect + toggle + toast, semantic tokens → Tasks 12, 13. ✅
- Client-safe fns returning only non-secret fields → Task 8. ✅
- Unit tests for holder + hash/diff; injectable network; e2e smoke → Tasks 3, 4, 14 (network isolation: `google-api.server.ts` is a thin fetch layer, business logic lives in pure modules). ✅
- Disconnect leaves Google events in place → Task 8 (delete credential only; documented). ✅
- Env vars + Google setup on user → Manual setup section. ✅

**Placeholder scan:** No TBD/TODO in code steps. The two migration-filename timestamps and the pg_cron URL/key convention are explicitly flagged to match the repo's existing newest migration — this is a real, repo-specific lookup, not a vague instruction.

**Type consistency:** `DesiredEvent`, `ExistingLink`, `ConnectedHolder`, `FamilyAdultLink`, `GoogleTokens` are defined once (Tasks 3, 4, 6) and consumed with matching names/shapes in Task 7. Server-fn names in Task 8 match imports in Tasks 9/12. `syncNow` (Task 7) matches Task 11 calls. `runCalendarSyncWindow` (Task 7) matches Task 10.

**Out of scope (unchanged):** listener bookings, service-account model, two-way sync, cleanup of already-created events on disconnect.
