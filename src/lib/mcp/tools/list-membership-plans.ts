import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_membership_plans",
  title: "List SomeoneNear membership plans",
  description:
    "Returns SomeoneNear's two Care Membership plans with monthly pricing in INR and USD, AI-companion quotas, and included features. Public catalog data, safe for anyone to read.",
  inputSchema: {
    currency: z
      .enum(["INR", "USD"])
      .optional()
      .describe("Filter to a single currency. Omit to return both."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ currency }) => {
    const plans = [
      {
        id: "care",
        name: "Care",
        blurb: "For one loved one you want to keep an eye on.",
        ai_messages_per_day: 40,
        sessions_per_month: 18,
        members: 1,
        pricing: { INR: { monthly: 3999 }, USD: { monthly: 49 } },
        features: [
          "18 Check-In calls a month",
          "15 minutes per call",
          "Family dashboard updates after every call",
          "Companion chat with a daily message allowance",
        ],
      },
      {
        id: "care_plus",
        name: "Care Plus",
        blurb: "For families sharing the care between them.",
        highlight: true,
        ai_messages_per_day: null, // unlimited
        sessions_per_month: 30,
        members: 5,
        pricing: { INR: { monthly: 6499 }, USD: { monthly: 79 } },
        features: [
          "30 Check-In calls a month",
          "15 minutes per call",
          "Unlimited Companion chat, no daily cap",
          "Shared circle, up to 5 people",
          "On-demand Check-Ins when a day feels hard",
        ],
      },
    ];

    const shaped = plans.map((p) =>
      currency ? { ...p, pricing: { [currency]: p.pricing[currency as "INR" | "USD"] } } : p,
    );

    return {
      content: [{ type: "text", text: JSON.stringify(shaped, null, 2) }],
      structuredContent: { plans: shaped },
    };
  },
});
