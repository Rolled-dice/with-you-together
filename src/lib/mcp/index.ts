import { defineMcp } from "@lovable.dev/mcp-js";
import getAppInfoTool from "./tools/get-app-info";
import listCrisisHotlinesTool from "./tools/list-crisis-hotlines";
import listGroundingExercisesTool from "./tools/list-grounding-exercises";
import listMembershipPlansTool from "./tools/list-membership-plans";

export default defineMcp({
  name: "withu-mcp",
  title: "WithU",
  version: "0.1.0",
  instructions:
    "Public tools for the WithU family wellbeing app. Read-only access to membership plans, crisis hotlines, grounding exercises, and general app info. No user or account data is exposed.",
  tools: [getAppInfoTool, listMembershipPlansTool, listCrisisHotlinesTool, listGroundingExercisesTool],
});
