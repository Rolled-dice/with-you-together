import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getAppInfoTool from "./tools/get-app-info";
import listCrisisHotlinesTool from "./tools/list-crisis-hotlines";
import listGroundingExercisesTool from "./tools/list-grounding-exercises";
import listMembershipPlansTool from "./tools/list-membership-plans";

// Require Supabase-issued OAuth tokens so anonymous callers cannot invoke tools
// once the app is published. The project's Supabase Auth acts as the issuer;
// any signed-in user of the app can obtain a valid token, and unauthenticated
// requests are rejected by the MCP runtime.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const issuerUrl = supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/auth/v1` : "";

export default defineMcp({
  name: "besideu-mcp",
  title: "BesideU",
  version: "0.1.0",
  instructions:
    "Authenticated tools for the BesideU family wellbeing app. Read-only access to membership plans, crisis hotlines, grounding exercises, and general app info. No user or account data is exposed.",
  tools: [getAppInfoTool, listMembershipPlansTool, listCrisisHotlinesTool, listGroundingExercisesTool],
  ...(issuerUrl
    ? {
        auth: auth.oauth.issuer({
          issuer: issuerUrl,
          acceptedAudiences: "authenticated",
          resourceName: "BesideU MCP",
        }),
      }
    : {}),
});
