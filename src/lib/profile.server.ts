import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const PROFILE_FIELDS =
  "id, display_name, full_name, pronouns, timezone, care_tier, care_status, care_since, care_intent, avatar_url, phone, phone_country, phone_verified, preferred_currency, preferred_language";

export function samePhone(left: string | null, right: string | null): boolean {
  const digits = (value: string | null) => (value ?? "").replace(/\D/g, "");
  if (!(left ?? "").trim() && !(right ?? "").trim()) return true;
  const leftDigits = digits(left);
  return leftDigits.length >= 7 && leftDigits === digits(right);
}

export function phoneChangePatch(
  current: string | null,
  incoming: string | null | undefined,
): Pick<ProfileUpdate, "phone" | "phone_verified"> {
  if (incoming === undefined || samePhone(current, incoming)) return {};
  return { phone: incoming, phone_verified: false };
}

export async function readProfile(supabase: SupabaseClient<Database>, userId: string) {
  const query = () => supabase.from("profiles").select(PROFILE_FIELDS).eq("id", userId);
  const { data, error } = await query().maybeSingle();
  if (error) throw new Error(`Unable to load your profile: ${error.message}`);
  if (data) return data;

  const { error: createError } = await supabase.from("profiles").insert({ id: userId });
  if (createError) throw new Error(`Unable to create your profile: ${createError.message}`);
  const { data: created, error: readError } = await query().single();
  if (readError) throw new Error(`Unable to load your new profile: ${readError.message}`);
  return created;
}

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ProfileUpdate,
) {
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .single();
  if (readError) throw new Error(`Unable to check your saved number: ${readError.message}`);

  const patch: ProfileUpdate = { ...input };
  if (input.phone !== undefined) {
    const change = phoneChangePatch(current.phone, input.phone);
    if (change.phone === undefined) delete patch.phone;
    else Object.assign(patch, change);
  }
  if (Object.keys(patch).length === 0) return { ok: true as const };

  // Authenticated server path for phone edits; browser UPDATE grants are narrowed
  // by migration so verified and tier fields cannot be forged through PostgREST.
  const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
