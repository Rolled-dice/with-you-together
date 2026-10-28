import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const FamilyPhone = z
  .string()
  .trim()
  .max(30)
  .transform((value, ctx) => {
    const phone = parsePhoneNumberFromString(value);
    if (!phone?.isValid()) {
      ctx.addIssue({ code: "custom", message: "Enter a phone number with its country code." });
      return z.NEVER;
    }
    return phone.number;
  });
export const FamilyTimezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone.");
export const SharingInput = z.object({
  receive_reminders: z.boolean(),
  share_updates: z.boolean(),
  share_health: z.boolean(),
});
export type SharingChoices = z.infer<typeof SharingInput>;
export const NO_SHARING: SharingChoices = {
  receive_reminders: false,
  share_updates: false,
  share_health: false,
};
export const FamilyNameInput = z.object({ name: z.string().trim().min(1).max(80) });
export const FamilyIdInput = z.object({ id: z.string().uuid() });
export const FamilyTokenInput = z.object({ token: z.string().min(8).max(200) });
export const FamilyInviteInput = z
  .discriminatedUnion("contact_channel", [
    z.object({
      contact_channel: z.literal("email"),
      email: z.string().trim().email().max(200).toLowerCase(),
    }),
    z.object({ contact_channel: z.literal("sms"), contact_phone: FamilyPhone }),
  ])
  .and(
    z.object({
      invitee_name: z.string().trim().min(1).max(80),
      relationship: z.string().trim().min(1).max(50),
      call_window: z.string().trim().max(160).optional(),
      call_timezone: FamilyTimezone,
    }),
  );
export const FamilyAcceptInput = FamilyTokenInput.extend({
  display_name: z.string().trim().min(1).max(80),
  call_phone: FamilyPhone,
  call_window: z.string().trim().min(3).max(160),
  call_timezone: FamilyTimezone,
  adult_confirmed: z.literal(true),
  ...SharingInput.shape,
});
export const VerificationInput = FamilyIdInput.extend({
  attempt_id: z.string().uuid(),
  outcome: z.enum(["verified", "no_answer", "declined", "technical_failure"]),
  consent_confirmed: z.boolean().default(false),
  note: z.string().trim().max(1000).default(""),
}).refine(
  (data) => data.outcome !== "verified" || data.consent_confirmed,
  "Confirm identity and consent first.",
);
export const ReopenInput = FamilyIdInput.extend({
  attempt_id: z.string().uuid(),
  recipient_requested: z.literal(true),
  note: z.string().trim().min(10).max(1000),
});
export const FamilyStatus = z.enum([
  "pending",
  "verification_pending",
  "active",
  "accepted",
  "declined",
  "expired",
  "revoked",
  "verification_closed",
]);
export const FAMILY_STATUS_LABELS: Record<z.infer<typeof FamilyStatus>, string> = {
  pending: "Awaiting response",
  verification_pending: "Verification pending",
  active: "Active",
  accepted: "Active",
  declined: "Declined",
  expired: "Expired",
  revoked: "Revoked",
  verification_closed: "Verification closed",
};
export const FamilyInviteRow = z.object({
  id: z.string(),
  invitee_name: z.string(),
  relationship: z.string(),
  email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_channel: z.enum(["email", "sms"]),
  status: FamilyStatus,
  delivery_status: z.enum(["not_sent", "sending", "sent", "failed"]),
  attempts: z.number(),
  call_window: z.string().nullable(),
  call_timezone: z.string(),
  expires_at: z.string(),
  created_at: z.string(),
});
export const FamilyMember = z.object({
  id: z.string(),
  user_id: z.string(),
  role: z.enum(["owner", "adult", "teen"]),
  joined_at: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable().optional(),
  timezone: z.string(),
  ...SharingInput.shape,
});
export const FamilySnapshot = z.object({
  viewer_id: z.string(),
  family: z
    .object({ id: z.string(), name: z.string(), owner_id: z.string(), created_at: z.string() })
    .nullable(),
  myRole: z.enum(["owner", "adult", "teen"]).nullable(),
  canInvite: z.boolean().nullable().transform(Boolean),
  members: z.array(FamilyMember),
  invites: z.array(FamilyInviteRow),
  pending: z.array(
    z.object({
      id: z.string(),
      family_name: z.string(),
      status: FamilyStatus,
      attempts: z.number(),
      call_window: z.string().nullable(),
    }),
  ),
});
export type FamilySnapshotData = z.infer<typeof FamilySnapshot>;
export const VerificationQueue = z.object({
  viewer_id: z.string(),
  is_admin: z.boolean(),
  rows: z.array(
    z.object({
      id: z.string(),
      invitee_name: z.string(),
      relationship: z.string(),
      status: FamilyStatus,
      attempts: z.number(),
      call_window: z.string().nullable(),
      call_timezone: z.string(),
      call_phone: z.string().nullable(),
      assigned_to: z.string().nullable(),
      created_at: z.string(),
      history: z.array(z.object({ outcome: z.string(), note: z.string(), created_at: z.string() })),
    }),
  ),
});
export function reservedFamilyPlaces(
  data: Pick<FamilySnapshotData, "members" | "invites">,
  now = Date.now(),
) {
  return (
    data.members.length +
    data.invites.filter(
      (invite) =>
        ["pending", "verification_pending"].includes(invite.status) &&
        Date.parse(invite.expires_at) > now,
    ).length
  );
}
