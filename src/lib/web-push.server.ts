import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from "@block65/webcrypto-web-push";
import { z } from "zod";

const endpointSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://"));

export type ReminderPushDevice = {
  endpoint: string;
  p256dh: string;
  authKey: string;
};

export type ReminderPushMessage = {
  destination: string;
  title?: string;
  body?: string;
  discreet?: boolean;
};

export type PushDeliveryOutcome = "sent" | "expired" | "retry";

export function isFamilyPushEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.FAMILY_PUSH_ENABLED === "true";
}

export function assertWebPushConfigured(environment: NodeJS.ProcessEnv = process.env): VapidKeys {
  const keys = {
    subject: environment.WEB_PUSH_SUBJECT,
    publicKey: environment.WEB_PUSH_PUBLIC_KEY,
    privateKey: environment.WEB_PUSH_PRIVATE_KEY,
  };
  if (!keys.subject?.startsWith("mailto:") || !keys.publicKey || !keys.privateKey)
    throw new Error("Web Push is not configured.");
  return keys;
}

function safeDestination(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/reminders";
  return value;
}

export async function sendGenericReminderPush(
  device: ReminderPushDevice,
  message: ReminderPushMessage,
  environment: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<PushDeliveryOutcome> {
  if (!isFamilyPushEnabled(environment)) return "retry";

  const subscription: PushSubscription = {
    endpoint: endpointSchema.parse(device.endpoint),
    expirationTime: null,
    keys: { p256dh: device.p256dh, auth: device.authKey },
  };
  const isDiscreet = message.discreet === true;
  const pushTitle = isDiscreet ? "SomeoneNear · Reminder" : (message.title || "SomeoneNear");
  const pushBody = isDiscreet
    ? "You have a scheduled check-in. Tap to view."
    : (message.body || "You have an update waiting in SomeoneNear.");

  const pushData: Record<string, string | number | boolean> = {
    version: 1,
    destination: safeDestination(message.destination),
    title: pushTitle,
    body: pushBody,
    discreet: isDiscreet,
  };

  const payload = await buildPushPayload(
    {
      data: pushData,
      options: { ttl: 300, urgency: "high", topic: "someonenear-reminder" },
    },
    subscription,
    assertWebPushConfigured(environment),
  );
  const response = await request(subscription.endpoint, payload);
  if (response.ok) return "sent";
  if (response.status === 404 || response.status === 410) return "expired";
  return "retry";
}
