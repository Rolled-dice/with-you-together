import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "id, display_name, full_name, pronouns, timezone, care_tier, care_status, care_since, care_intent, avatar_url, phone, phone_country, phone_verified, preferred_currency, preferred_language",
      )
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return data;
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
    const patch: Record<string, unknown> = { ...data };

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

const TierInput = z.object({
  care_tier: z.enum(["free", "together", "family", "care"]),
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
