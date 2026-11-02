import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const reference = readFileSync("docs/reference/original-integrated-platform.tsx.txt");
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
const forbidden = changed.filter((file) =>
  /(^supabase\/|^src\/integrations\/|^src\/routes\/api\/|\.(functions|server)\.ts$)/.test(file),
);
assert.deepEqual(forbidden, [], "Frontend work modified protected backend contracts");
console.log("Original avatar artwork and main backend contracts are preserved.");
