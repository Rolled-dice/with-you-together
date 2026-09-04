import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_membership_plans",
  title: "List SomeoneNear membership plans",
  description:
    "Returns SomeoneNear's Care Membership tiers with monthly and yearly pricing in INR and USD, AI-companion quotas, and included features. Public catalog data — safe for anyone to read.",
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
        id: "gentle_start",
        name: "Gentle Start",
        blurb: "Solo mood check-ins + light AI conversations.",
        ai_messages_per_month: 25,
        pricing: { INR: { monthly: 299, yearly: 2990 }, USD: { monthly: 4.99, yearly: 49 } },
        features: ["Mood check-ins", "Mood trends", "25 AI companion messages / month", "Safety resources"],
      },
      {
        id: "together",
        name: "Together",
        blurb: "Full AI companion, listener sessions, insights.",
        ai_messages_per_month: 500,
        trial_days: 7,
        pricing: { INR: { monthly: 799, yearly: 7990 }, USD: { monthly: 12.99, yearly: 129 } },
        features: [
          "Everything in Gentle Start",
          "500 AI companion messages / month",
          "Human listener sessions",
          "Insights & mood trends",
          "7-day free trial",
        ],
      },
      {
        id: "family",
        name: "Family",
        blurb: "Shared circle for up to 5 members with pooled sessions.",
        ai_messages_per_month: 2000,
        pricing: { INR: { monthly: 1499, yearly: 14990 }, USD: { monthly: 24.99, yearly: 249 } },
        features: [
          "Everything in Together",
          "Up to 5 family members",
          "2000 AI messages / month (pooled)",
          "Shared listener session pool",
          "Family circle dashboard",
        ],
      },
    ];

    const shaped = plans.map((p) =>
      currency ? { ...p, pricing: { [currency]: p.pricing[currency] } } : p,
    );

    return {
      content: [{ type: "text", text: JSON.stringify(shaped, null, 2) }],
      structuredContent: { plans: shaped },
    };
  },
});
