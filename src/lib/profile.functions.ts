import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { readProfile, updateProfile } from "./profile.server";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => readProfile(context.supabase, context.userId));

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
  onboarding_completed: z.literal(true).optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProfileInput.parse(input))
  .handler(({ context, data }) => updateProfile(context.supabase, context.userId, data));
