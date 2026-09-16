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
