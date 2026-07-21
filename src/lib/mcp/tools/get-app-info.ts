import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_app_info",
  title: "About WithU",
  description:
    "Returns a public overview of the WithU app: what it does, who it's for, main features, and links. Safe for anyone to read.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = {
      name: "WithU",
      slogan: "Love, on the same page.",
      description:
        "WithU is a family-first emotional wellbeing app combining an AI companion, private journaling, human listener sessions, and a shared family circle.",
      audience: "Individuals 13+ and families looking for calm, safe, private mental-wellbeing support.",
      features: [
        "AI Companion chat with mood-aware prompts",
        "Private journaling with mood tracking and PDF export",
        "Human listener booking with rescheduling",
        "Family Circle with shared session pool",
        "Crisis resources and grounding exercises",
      ],
      links: {
        website: "https://ask-if-needed.lovable.app",
        custom_domain: "https://withu.rolledice.in",
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
