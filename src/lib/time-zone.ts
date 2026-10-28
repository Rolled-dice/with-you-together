/** Resolve a wall-clock time only when its timezone maps it to one instant. */
export function combineToUtc(day: string, time: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time))
    throw new Error("Choose a valid date and time.");
  const wall = `${day}T${time.length === 5 ? `${time}:00` : time}`;
  const naive = new Date(`${wall}Z`).getTime();
  if (!Number.isFinite(naive)) throw new Error("Choose a valid date and time.");
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  function local(instant: number) {
    const parts = Object.fromEntries(
      format.formatToParts(instant).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  }
  // Sample both sides of a possible daylight-saving change, then validate each candidate.
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const sample = naive + hours * 3600000;
      return new Date(`${local(sample)}Z`).getTime() - sample;
    }),
  );
  const matches = [...offsets]
    .map((offset) => naive - offset)
    .filter((instant) => local(instant) === wall);
  if (!matches.length)
    throw new Error(
      "This local time does not exist. Choose a time outside the daylight-saving change.",
    );
  if (matches.length > 1)
    throw new Error(
      "This local time occurs twice. Choose a time outside the daylight-saving change.",
    );
  return new Date(matches[0]).toISOString();
}
