import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const fallbackProfile = {
      id: context.userId,
      display_name: null,
      full_name: null,
      pronouns: null,
      timezone: "UTC",
      care_tier: "free",
      care_status: null,
      care_since: null,
      care_intent: null,
      avatar_url: null,
      phone: null,
      phone_country: null,
      phone_verified: false,
      preferred_currency: null,
      preferred_language: "en",
    };
    const { data, error } = await context.supabase
      .from("profiles")
      // Keep the first read compatible with older production schemas. Newer
      // profile fields are loaded below on a best-effort basis.
      .select("id, display_name, timezone, avatar_url, care_tier, care_status, care_since, pronouns")
      .eq("id", context.userId)
      .maybeSingle();
    // A stale PostgREST schema cache must not block the family screen. The
    // family endpoint remains the source of truth for membership permissions.
    if (error) return fallbackProfile;
    if (!data) {
      // Older accounts can predate the profile trigger. Create the same
      // minimal row a new account would receive so member pages can recover.
      const { data: created, error: createError } = await context.supabase
        .from("profiles")
        .insert({ id: context.userId })
        .select(
          "id, display_name, timezone, avatar_url, care_tier, care_status, care_since, pronouns",
        )
        .single();
      if (createError) return fallbackProfile;
      return {
        ...created,
        full_name: null,
        care_intent: null,
        phone: null,
        phone_country: null,
        phone_verified: false,
        preferred_currency: null,
        preferred_language: "en",
      };
    }

    const { data: extras } = await context.supabase
      .from("profiles")
      .select("full_name, care_intent, phone, phone_country, phone_verified, preferred_currency, preferred_language")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      ...data,
      full_name: extras?.full_name ?? null,
      care_intent: extras?.care_intent ?? null,
      phone: extras?.phone ?? null,
      phone_country: extras?.phone_country ?? null,
      phone_verified: extras?.phone_verified ?? false,
      preferred_currency: extras?.preferred_currency ?? null,
      preferred_language: extras?.preferred_language ?? "en",
    };
  });

const ProfileInput = z.object({
  display_name: z.string().max(100).nullable().optional(),
  full_name: z.string().max(100).nullable().optional(),
  pronouns: z.string().max(50).nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  care_intent: z.string().max(500).nullable().optional(),
  preferred_language: z.enum(["en", "hi"]).optional(),
  preferred_currency: z.enum(["inr", "usd"]).optional(),
  phone: z.string().max(30).nullable().optional(),
  phone_country: z.string().length(2).nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileInput.parse(input))
  .handler(async ({ context, data }) => {
    const patch: z.infer<typeof ProfileInput> & { phone_verified?: boolean } = { ...data };

    // Changing the mobile number invalidates any previous verification.
    if (data.phone !== undefined) {
      const { data: current } = await context.supabase
        .from("profiles")
        .select("phone")
        .eq("id", context.userId)
        .single();
      const before = (current?.phone ?? "") as string;
      const after = data.phone ?? "";
      if (before !== after) patch.phone_verified = false;
    }

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Two live plans plus the unsubscribed state. The legacy `together` and
// `family` tiers were retired with the two-plan migration and must not be
// accepted here, or a stale client could write a tier billing can't map.
const TierInput = z.object({
  care_tier: z.enum(["free", "care", "care_plus"]),
});

export const updateCareTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TierInput.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ care_tier: data.care_tier })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Called client-side after Supabase OTP verify to persist verified state.
export const markPhoneVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      phone: z.string().max(30),
      phone_country: z.string().length(2).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        phone: data.phone,
        phone_country: data.phone_country ?? null,
        phone_verified: true,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
