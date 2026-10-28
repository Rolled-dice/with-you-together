import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  FamilyAcceptInput,
  FamilyIdInput,
  FamilyInviteInput,
  FamilyNameInput,
  FamilyTokenInput,
  ReopenInput,
  SharingInput,
  VerificationInput,
} from "./family.schemas";
import {
  deliverFamilyInvite,
  familyCommand,
  familyDeliveryConfig,
  familySnapshot,
  lookupFamilyInvite,
  verificationQueue,
} from "./family.server";

export const getMyFamily = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => familySnapshot(context.userId));
export const getFamilyDeliveryConfig = createServerFn({ method: "GET" }).handler(() =>
  familyDeliveryConfig(),
);
export const createFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyNameInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "create", data));
export const renameFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyNameInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "rename", data));
export const inviteFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyInviteInput.parse(i))
  .handler(async ({ context, data }) => {
    const { id } = FamilyIdInput.parse(await familyCommand(context.userId, "invite", data));
    return deliverFamilyInvite(context.userId, id);
  });
export const resendFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyIdInput.parse(i))
  .handler(({ context, data }) => deliverFamilyInvite(context.userId, data.id));
export const revokeFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyIdInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "revoke", data));
export const getInvitationByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyTokenInput.parse(i))
  .handler(({ context, data }) => lookupFamilyInvite(context.userId, data));
export const acceptFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyAcceptInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "accept", data));
export const declineFamilyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyTokenInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "decline", data));
export const removeFamilyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ member_id: z.string().uuid() }).parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "remove", data));
export const leaveFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => familyCommand(context.userId, "leave"));
export const deleteFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => familyCommand(context.userId, "delete"));
export const saveFamilySharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SharingInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "sharing", data));
export const getVerificationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => verificationQueue(context.userId));
export const claimVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FamilyIdInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "claim_verification", data));
export const recordVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => VerificationInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "verify", data));
export const reopenVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReopenInput.parse(i))
  .handler(({ context, data }) => familyCommand(context.userId, "reopen", data));
