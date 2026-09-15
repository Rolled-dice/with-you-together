import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const EXERCISES = [
  {
    id: "5-4-3-2-1",
    name: "5-4-3-2-1 Senses",
    duration_minutes: 3,
    steps: [
      "Name 5 things you can see.",
      "Name 4 things you can feel.",
      "Name 3 things you can hear.",
      "Name 2 things you can smell.",
      "Name 1 thing you can taste.",
    ],
  },
  {
    id: "box-breathing",
    name: "Box Breathing",
    duration_minutes: 4,
    steps: [
      "Inhale slowly for 4 counts.",
      "Hold your breath for 4 counts.",
      "Exhale slowly for 4 counts.",
      "Hold empty for 4 counts.",
      "Repeat 4-6 rounds.",
    ],
  },
  {
    id: "body-scan",
    name: "Quick Body Scan",
    duration_minutes: 5,
    steps: [
      "Sit or lie down comfortably.",
      "Notice your feet, any tension? Let it soften.",
      "Move attention up through legs, hips, belly, chest.",
      "Relax shoulders, jaw, and forehead.",
      "Take three slow breaths and open your eyes.",
    ],
  },
  {
    id: "warm-anchor",
    name: "Warm Anchor",
    duration_minutes: 2,
    steps: [
      "Place a hand on your chest and one on your belly.",
      "Feel warmth where your hands touch.",
      "Breathe in for 4, out for 6, five times.",
      "Say to yourself: 'I am safe in this moment.'",
    ],
  },
];

export default defineTool({
  name: "list_grounding_exercises",
  title: "List grounding & calming exercises",
  description:
    "Returns short grounding and breathing exercises from SomeoneNear's public safety library. Optional id filter returns a single exercise.",
  inputSchema: {
    id: z.string().optional().describe("Return a single exercise by id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ id }) => {
    const data = id ? EXERCISES.filter((e) => e.id === id) : EXERCISES;
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { exercises: data },
    };
  },
});
