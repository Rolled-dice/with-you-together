import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  assertWebPushConfigured,
  isFamilyPushEnabled,
  sendGenericReminderPush,
  type ReminderPushDevice,
} from "./web-push.server";

const claimedJobSchema = z.object({
  id: z.string().uuid(),
  lease_token: z.string().uuid(),
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(32).max(256),
  auth: z.string().min(16).max(128),
  url: z.string().min(1).max(1024),
  title: z.string().optional(),
  body: z.string().optional(),
});

type ReminderPushSender = (
  device: ReminderPushDevice,
  message: { destination: string; title?: string; body?: string },
  environment: NodeJS.ProcessEnv,
) => Promise<"sent" | "expired" | "retry">;

export async function prepareFamilyReminders(client: SupabaseClient = supabaseAdmin) {
  const { data, error } = await client.rpc("prepare_reminder_delivery");
  if (error) throw new Error("Reminder preparation failed");
  return { prepared: z.number().int().nonnegative().parse(data), sent: 0, pushEnabled: false };
}

export async function deliverFamilyReminders(
  client: SupabaseClient = supabaseAdmin,
  environment: NodeJS.ProcessEnv = process.env,
  sender: ReminderPushSender = sendGenericReminderPush,
) {
  const prepared = await prepareFamilyReminders(client);
  if (!isFamilyPushEnabled(environment)) {
    return {
      prepared: prepared.prepared,
      claimed: 0,
      sent: 0,
      retried: 0,
      expired: 0,
      pushEnabled: false,
    };
  }

  assertWebPushConfigured(environment);
  const { data, error } = await client.rpc("claim_reminder_push");
  if (error) throw new Error("Could not claim reminder push jobs.");
  const jobs = z.array(claimedJobSchema).parse(data);
  const totals = {
    prepared: prepared.prepared,
    claimed: jobs.length,
    sent: 0,
    retried: 0,
    expired: 0,
    pushEnabled: true,
  };

  for (const job of jobs) {
    let outcome: "sent" | "gone" | "retry" = "retry";
    try {
      const message: { destination: string; title?: string; body?: string } = {
        destination: job.url,
      };
      if (job.title) message.title = job.title;
      if (job.body) message.body = job.body;
      const result = await sender(
        { endpoint: job.endpoint, p256dh: job.p256dh, authKey: job.auth },
        message,
        environment,
      );
      outcome = result === "expired" ? "gone" : result;
    } catch {
      outcome = "retry";
    }

    const { error: finishError } = await client.rpc("finish_reminder_push", {
      p_id: job.id,
      p_lease: job.lease_token,
      p_outcome: outcome,
    });
    if (finishError) throw new Error("Could not finish reminder push delivery.");
    if (outcome === "sent") totals.sent += 1;
    else if (outcome === "gone") totals.expired += 1;
    else totals.retried += 1;
  }

  return totals;
}
