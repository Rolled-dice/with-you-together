import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_app_info",
  title: "About SomeoneNear",
  description:
    "Returns a public overview of the SomeoneNear app: what it does, who it's for, main features, and links. Safe for anyone to read.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      name: "SomeoneNear",
      slogan: "Love, on the same page.",
      description:
        "SomeoneNear is a family-first emotional wellbeing app combining an AI companion, human listener sessions, mood insights, and a shared family circle.",
      audience: "Individuals 13+ and families looking for calm, safe, private mental-wellbeing support.",
      features: [
        "AI Companion chat with mood-aware prompts",
        "Private mood check-ins with trends and streaks",
        "Human listener booking with rescheduling",
        "Family Circle with shared session pool",
        "Crisis resources and grounding exercises",
      ],
      links: {
        website: "https://someonenear.com",
        custom_domain: "https://someonenear.com",
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
