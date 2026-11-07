import { z } from "zod";
export const timeZoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "Choose a valid IANA timezone.");
export function localInput(instant: Date, zone: string) {
  timeZoneSchema.parse(zone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
// Probe offsets either side of the requested day, then verify each candidate.
// Reject both nonexistent and ambiguous DST wall times rather than silently shift them.
export function localToUtc(value: string, zone: string): string {
  timeZoneSchema.parse(zone);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Choose a valid date and time.");
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall)) throw new Error("Choose a valid date and time.");
  const candidates = new Set<number>();
  for (let h = -48; h <= 48; h += 6) {
    const probe = wall + h * 3_600_000;
    const offset = Date.parse(`${localInput(new Date(probe), zone)}:00Z`) - probe;
    const candidate = wall - offset;
    if (localInput(new Date(candidate), zone) === value) candidates.add(candidate);
  }
  if (candidates.size !== 1)
    throw new Error(
      "This time is skipped or repeated by daylight saving. Please choose another time.",
    );
  return new Date([...candidates][0]).toISOString();
}
export function displayTime(value: string, zone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timeZoneSchema.parse(zone),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
