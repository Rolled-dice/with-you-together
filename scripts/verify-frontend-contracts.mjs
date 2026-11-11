import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
// Git checks out CRLF on Windows; hash the archived source with canonical newlines.
const reference = readFileSync(
  "docs/reference/original-integrated-platform.tsx.txt",
  "utf8",
).replace(/\r\n/g, "\n");
assert.equal(
  createHash("sha256").update(reference).digest("hex"),
  "d834fe90cbcf91baa680f42e071574bf124e8b02bd4c2ea2cfad9165f4aa3676",
);
const source = reference.toString();
const original = source.slice(
  source.indexOf("export const EditorialAvatar"),
  source.indexOf("export const ThreeJsFamilyStage"),
);
const current = readFileSync("src/components/identity/editorial-avatar.tsx", "utf8");
// Pin the SVG geometry and literal colors, independent of TypeScript/formatter whitespace.
const artwork = (text) =>
  [
    ...text.matchAll(
      /\b(?:d|fill|stroke|cx|cy|r|rx|ry|x1|x2|y1|y2|viewBox|strokeWidth)\s*=\s*["']([^"']*)["']/g,
    ),
  ].map((match) => match[0].replaceAll("'", '"').replace(/\s*=\s*/g, "="));
assert.deepEqual(artwork(current), artwork(original), "Original avatar artwork changed");
const changed = execFileSync("git", ["diff", "--name-only", "origin/main"], { encoding: "utf8" })
  .trim()
  .split("\n");
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .trim()
  .split("\n");
// User-approved backend launch work is additive and separately SQL-tested.
const approvedBackendFiles = new Set([
  "supabase/migrations/20261104061149_launch_shared_call_ledger.sql",
  "src/lib/launch-checkout.functions.ts",
  "src/lib/launch-checkout.server.ts",
  // User requested notification repair: exact owner-scoped inbox counts and explicit read IDs.
  "src/lib/notifications.functions.ts",
  "src/lib/notification-inbox.server.ts",
  "src/lib/web-push.server.ts",
  "src/lib/family-reminder-delivery.server.ts",
  "src/lib/telnyx.server.ts",
  "src/lib/reminders.functions.ts",
  // User requested direct AWS Companion integration with existing server credentials.
  "src/routes/api/chat.ts",
  "src/lib/aws-config.server.ts",
  "src/lib/companion-store.server.ts",
  "src/lib/companion-generation.server.ts",
  "src/lib/companion-summary.functions.ts",
  "src/lib/memories.functions.ts",
  "src/lib/conversations.functions.ts",
  "src/lib/media-storage.server.ts",
  "src/lib/send-later.server.ts",
  "src/lib/send-later.functions.ts",
  "src/lib/family.functions.ts",
  "src/lib/s3.server.ts",
  "src/lib/medications.functions.ts",
  "src/lib/medication-doses.server.ts",
  "src/lib/prescription.server.ts",
  "src/lib/scheduler-auth.server.ts",
  "src/routes/api/public/hooks/send-later.ts",
  "src/routes/api/public/hooks/call-sla.ts",
  "src/routes/api/public/hooks/calendar-sync.ts",
  "src/lib/call-console.server.ts",
  "src/lib/call-crm.functions.ts",
  "src/lib/dodo.config.server.ts",
  "src/lib/dodo.server.ts",
  "src/lib/listeners.functions.ts",
  "src/lib/profile.functions.ts",
  "src/lib/profile.server.ts",
  "src/lib/telnyx-calls.server.ts",
  "src/routes/api/public/payments/-dodo-webhook.test.ts",
  "src/routes/api/public/payments/dodo-webhook.ts",
  "supabase/migrations/20261111190000_live_entitlements_and_profile_write_guard.sql",
]);
const forbidden = [...new Set([...changed, ...untracked])].filter(
  (file) =>
    !approvedBackendFiles.has(file) &&
    // Approved launch addition: read-only, public edge-country display suggestion.
    file !== "src/lib/launch-market.functions.ts" &&
    // User confirmed migration of the app connection to the accessible live project.
    file !== "supabase/config.toml" &&
    /(^supabase\/|^src\/integrations\/|^src\/routes\/api\/|\.(functions|server)\.ts$)/.test(file),
);
assert.deepEqual(forbidden, [], "Unexpected changes to protected legacy backend contracts");
console.log(
  "Original avatar artwork is preserved; only explicitly approved backend paths are excepted.",
);
