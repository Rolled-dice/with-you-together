import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "list_crisis_hotlines",
  title: "List crisis and mental health hotlines",
  description:
    "Returns a curated list of publicly published mental-health crisis hotlines (India and international) with phone numbers and hours. Public safety information, safe for anyone to read.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const hotlines = [
      {
        name: "iCall (India)",
        phone: "+91 9152987821",
        hours: "Mon-Sat, 8am-10pm IST",
        region: "IN",
        url: "https://icallhelpline.org/",
      },
      {
        name: "Vandrevala Foundation (India)",
        phone: "1860-2662-345",
        hours: "24/7",
        region: "IN",
        url: "https://www.vandrevalafoundation.com/",
      },
      {
        name: "AASRA (India)",
        phone: "+91 9820466726",
        hours: "24/7",
        region: "IN",
        url: "http://www.aasra.info/",
      },
      {
        name: "988 Suicide & Crisis Lifeline (US)",
        phone: "988",
        hours: "24/7",
        region: "US",
        url: "https://988lifeline.org/",
      },
      {
        name: "Samaritans (UK & ROI)",
        phone: "116 123",
        hours: "24/7",
        region: "UK",
        url: "https://www.samaritans.org/",
      },
      {
        name: "Befrienders Worldwide",
        phone: "See directory",
        hours: "Varies",
        region: "Global",
        url: "https://www.befrienders.org/",
      },
    ];
    return {
      content: [{ type: "text", text: JSON.stringify(hotlines, null, 2) }],
      structuredContent: { hotlines },
    };
  },
});
