type ReminderEvent = { id: string; title: string; dueAt: string; recurrence?: string | null };
const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const timestamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
function foldLine(line: string) {
  let result = "",
    segment = "",
    bytes = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (bytes + length > 75) {
      result += segment + "\r\n";
      segment = " ";
      bytes = 1;
    }
    segment += char;
    bytes += length;
  }
  return result + segment;
}
export function buildReminderCalendar(event: ReminderEvent, now = new Date()) {
  const due = new Date(event.dueAt);
  if (!Number.isFinite(due.getTime())) throw new Error("This reminder does not have a valid date.");
  const frequency = (
    { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" } as Record<string, string>
  )[event.recurrence ?? ""];
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SomeoneNear//Care Reminder//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${escapeText(event.id)}@someonenear.com`,
      `DTSTAMP:${timestamp(now)}`,
      `DTSTART:${timestamp(due)}`,
      `DTEND:${timestamp(new Date(due.getTime() + 15 * 60_000))}`,
      `SUMMARY:${escapeText(event.title)}`,
      "DESCRIPTION:A gentle SomeoneNear reminder.",
      ...(frequency ? [`RRULE:FREQ=${frequency}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:-PT10M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
export function downloadReminderCalendar(event: ReminderEvent) {
  const url = URL.createObjectURL(
    new Blob([buildReminderCalendar(event)], { type: "text/calendar;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "someonenear-reminder.ics";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
