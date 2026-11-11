const MIN_LEAD_MS = 2 * 60 * 60 * 1000;

export function assertRescheduleAllowed(
  status: string,
  existingAt: string,
  newAt: string,
  now = Date.now(),
): void {
  if (!["requested", "confirmed"].includes(status)) {
    throw new Error("Only upcoming calls can be rescheduled.");
  }
  if (new Date(existingAt).getTime() - now < MIN_LEAD_MS) {
    throw new Error(
      "Reschedules must be made at least 2 hours before your session. Your existing booking is unchanged.",
    );
  }
  if (new Date(newAt).getTime() - now < MIN_LEAD_MS) {
    throw new Error("Please choose a new time at least 2 hours from now. Your existing booking is unchanged.");
  }
}
