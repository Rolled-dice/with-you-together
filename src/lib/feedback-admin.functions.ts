import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const STATUSES = ["new", "in_review", "planned", "resolved", "archived"] as const;
const CATEGORIES = [
  "feature_request",
  "bug_report",
  "product_feedback",
  "ai_feedback",
  "listener_feedback",
  "support",
] as const;

export type FeedbackPriority = (typeof PRIORITIES)[number];
export type FeedbackStatus = (typeof STATUSES)[number];
export type FeedbackCategory = (typeof CATEGORIES)[number];

export type AdminFeedbackRow = {
  id: string;
  user_id: string | null;
  category: FeedbackCategory;
  subject: string | null;
  message: string;
  email: string | null;
  page: string | null;
  priority: FeedbackPriority;
  triage_status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false };
    return { isAdmin: Boolean(data) };
  });

export const listAdminFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("feedback_submissions")
      .select(
        "id, user_id, category, subject, message, email, page, priority, triage_status, admin_notes, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as AdminFeedbackRow[] };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  priority: z.enum(PRIORITIES).optional(),
  triage_status: z.enum(STATUSES).optional(),
  admin_notes: z.string().max(4000).nullable().optional(),
});

export const updateAdminFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: {
      priority?: FeedbackPriority;
      triage_status?: FeedbackStatus;
      admin_notes?: string | null;
    } = {};
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.triage_status !== undefined) patch.triage_status = data.triage_status;
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("feedback_submissions")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
