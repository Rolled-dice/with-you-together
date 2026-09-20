/**
 * Seeds three test accounts so every UI surface can be exercised end to end:
 *
 *   admin    -> user_roles row with role 'admin'     -> /admin/calls, /admin/feedback, /admin/whatsapp
 *   listener -> call_agents row linked by user_id    -> /agent/console (softphone)
 *   member   -> plain user on the Care Plus tier     -> companion, listeners, family, reminders
 *
 * Why a script and not a migration: creating auth users means password hashing
 * and the auth.identities row, which you should never hand-write. The Admin API
 * does it correctly, and `handle_new_user()` then creates the profile for us.
 *
 * Why the listener needs SQL: `upsertCallAgent` in call-crm.functions.ts does not
 * accept or write `user_id`, so an agent created through the admin UI can never
 * satisfy `is_call_agent()` and cannot open the softphone. We set the link here.
 *
 *   node scripts/seed-dev-users.mjs            # create / update
 *   node scripts/seed-dev-users.mjs --destroy  # remove them again
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment. Never commit it.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* -------------------------------------------------------------------------- */
/* Config                                                                      */
/* -------------------------------------------------------------------------- */

// `.test` is a reserved, non-routable TLD (RFC 2606), so these addresses can
// never receive mail or collide with a real customer.
const DOMAIN = "someonenear.test";

const SEEDS = [
  {
    key: "admin",
    email: `admin@${DOMAIN}`,
    displayName: "Ada Admin",
    fullName: "Ada Admin",
    role: "admin",
    tier: "free",
  },
  {
    key: "listener",
    email: `listener@${DOMAIN}`,
    displayName: "Priya Listener",
    fullName: "Priya Listener",
    agent: {
      name: "Priya Listener",
      timezone: "Asia/Kolkata",
      skills: ["elder-care", "hindi", "english"],
      work_start: "09:00",
      work_end: "21:00",
      max_concurrent: 3,
    },
    tier: "free",
  },
  {
    key: "member",
    email: `member@${DOMAIN}`,
    displayName: "Meera",
    fullName: "Meera Nair",
    phone: "+919000000001",
    // Care Plus so quotas are unlimited and the family circle is unlocked.
    tier: "care_plus",
  },
];

/* -------------------------------------------------------------------------- */
/* Env                                                                         */
/* -------------------------------------------------------------------------- */

/** Minimal .env reader — a plain node script gets no Vite env loading. */
function loadEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k]) continue; // real env always wins
    process.env[k] = raw.replace(/^["']|["']$/g, "");
  }
}

// .env is committed and holds only publishable values. Secrets belong in
// .env.local, which is gitignored — load it first so it wins.
loadEnvFile(".env.local");
loadEnvFile(".env");
loadEnvFile(".env.development");

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD;

const destroy = process.argv.includes("--destroy");
const verify = process.argv.includes("--verify");

function die(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) die("SUPABASE_URL is not set (checked env, .env, .env.development).");
// --verify signs in the way the browser does, so it needs no service-role key.
if (!SERVICE_KEY && !verify) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
      "    Set it for this command only:\n" +
      '      $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."; npm run seed:users\n' +
      "    Or put it in .env.local, which is gitignored.\n" +
      "    Never put it in .env — that file IS committed.",
  );
}
// No default password on purpose: a hardcoded credential in the repo is exactly
// the kind of thing that survives into production by accident.
if (!destroy && !PASSWORD) {
  die(
    "SEED_PASSWORD is not set.\n" +
      "    Choose one for this run; it is never written to disk:\n" +
      '      $env:SEED_PASSWORD="<something long>"; node scripts/seed-dev-users.mjs',
  );
}
if (!destroy && !verify && PASSWORD.length < 12) {
  die("SEED_PASSWORD must be at least 12 characters.");
}

/**
 * A non-reversible fingerprint of the password the script actually received.
 *
 * This exists because the usual cause of "wrong password" is the shell eating
 * the value before node ever sees it: in PowerShell a `$` inside double quotes
 * interpolates, so "Pa$$w0rd1234" arrives as "Paw0rd1234". Printing length plus
 * a hash prefix lets you confirm the seed and your login attempt agree, without
 * putting the secret in your scrollback.
 */
async function fingerprint(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `len=${value.length} sha256=${hex.slice(0, 12)}`;
}

if (!destroy) {
  if (PASSWORD !== PASSWORD.trim()) {
    console.warn(
      "\n  ! SEED_PASSWORD has leading or trailing whitespace. That is part of the\n" +
        "    password and you will have to type it at sign-in. Probably not intended.",
    );
  }
  if (/\$/.test(PASSWORD)) {
    console.warn(
      "\n  ! SEED_PASSWORD contains a '$'. If you set it in PowerShell with double\n" +
        "    quotes, the shell may already have eaten part of it. Compare the\n" +
        "    fingerprint below against `node scripts/seed-dev-users.mjs --verify`.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Safety gate                                                                 */
/* -------------------------------------------------------------------------- */

// This project has no local Supabase — SUPABASE_URL points at the hosted
// project, so these writes are real. Require an explicit acknowledgement rather
// than letting a stray command create known-password logins in a live database.
const isLocal = /localhost|127\.0\.0\.1|kong:8000/.test(SUPABASE_URL);
// --verify only reads, so the write gate does not apply to it.
if (!verify && !isLocal && !process.argv.includes("--yes-write-to-hosted")) {
  die(
    `Refusing to run: ${SUPABASE_URL} is not a local Supabase.\n` +
      "    These accounts have a password you know, so they must never exist in\n" +
      "    production. If this is a development or staging project, re-run with:\n" +
      "      --yes-write-to-hosted",
  );
}

const supabase = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** The Admin API has no get-by-email, so page through and match. */
async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser(seed) {
  const existing = await findUserByEmail(seed.email);

  if (existing) {
    // Reset the password so a re-run always leaves a usable login.
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUserById(${seed.email}): ${error.message}`);
    return { id: existing.id, created: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: seed.email,
    password: PASSWORD,
    // Skip the confirmation mail; nothing can deliver to a .test address.
    email_confirm: true,
    user_metadata: {
      display_name: seed.displayName,
      full_name: seed.fullName,
      ...(seed.phone && { phone: seed.phone }),
      preferred_language: "en",
    },
  });
  if (error) throw new Error(`createUser(${seed.email}): ${error.message}`);
  return { id: data.user.id, created: true };
}

async function applyProfile(userId, seed) {
  // The profile row already exists — handle_new_user() created it on insert.
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: seed.displayName,
      full_name: seed.fullName,
      onboarding_completed: true, // skip the onboarding gate
      care_tier: seed.tier,
      care_status: seed.tier === "free" ? "inactive" : "active",
      timezone: seed.agent?.timezone ?? "Asia/Kolkata",
      ...(seed.phone && { phone: seed.phone, phone_country: "IN", phone_verified: true }),
    })
    .eq("id", userId);
  if (error) throw new Error(`profiles update(${seed.email}): ${error.message}`);
}

async function applyAdminRole(userId) {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (error) throw new Error(`user_roles upsert: ${error.message}`);
}

async function applyAgentRow(userId, agent, email) {
  // call_agents has no unique constraint on user_id, so upsert can't be used.
  const { data: existing, error: selErr } = await supabase
    .from("call_agents")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw new Error(`call_agents select: ${selErr.message}`);

  const row = { ...agent, user_id: userId, email, is_active: true };

  if (existing) {
    const { error } = await supabase.from("call_agents").update(row).eq("id", existing.id);
    if (error) throw new Error(`call_agents update: ${error.message}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("call_agents")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`call_agents insert: ${error.message}`);
  return data.id;
}

/* -------------------------------------------------------------------------- */
/* Destroy                                                                     */
/* -------------------------------------------------------------------------- */

async function runDestroy() {
  console.log(`\n  Removing seed accounts on ${SUPABASE_URL}\n`);
  for (const seed of SEEDS) {
    const user = await findUserByEmail(seed.email);
    if (!user) {
      console.log(`  · ${seed.email.padEnd(30)} not present`);
      continue;
    }
    // call_agents.user_id is ON DELETE SET NULL, so the roster row would survive
    // as an orphan. Remove it explicitly before deleting the user.
    await supabase.from("call_agents").delete().eq("user_id", user.id);
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`deleteUser(${seed.email}): ${error.message}`);
    console.log(`  ✓ ${seed.email.padEnd(30)} deleted`);
  }
  console.log("\n  profiles and user_roles cascade automatically.\n");
}

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

async function runSeed() {
  console.log(`\n  Seeding test accounts on ${SUPABASE_URL}`);
  // Print the fingerprint so it can be compared against --verify.
  console.log(`  Password being set: ${await fingerprint(PASSWORD)}\n`);
  const results = [];

  for (const seed of SEEDS) {
    const { id, created } = await ensureUser(seed);
    await applyProfile(id, seed);

    const grants = [];
    if (seed.role === "admin") {
      await applyAdminRole(id);
      grants.push("user_roles: admin");
    }
    if (seed.agent) {
      const agentId = await applyAgentRow(id, seed.agent, seed.email);
      grants.push(`call_agents: ${agentId.slice(0, 8)}… (active)`);
    }
    if (seed.tier !== "free") grants.push(`care_tier: ${seed.tier}`);

    results.push({ ...seed, id, created, grants });
    console.log(
      `  ${created ? "✓ created" : "· updated"}  ${seed.email.padEnd(30)} ${grants.join("  ") || "member"}`,
    );
  }

  console.log("\n  ─────────────────────────────────────────────────────────────");
  console.log("  Sign in at /auth with the password you passed as SEED_PASSWORD.\n");
  for (const r of results) {
    console.log(`  ${r.key.padEnd(9)} ${r.email}`);
  }
  console.log(`
  What each one unlocks:
    admin      /admin/calls, /admin/feedback, /admin/whatsapp
    listener   /agent/console  (softphone; needs mic permission)
    member     /companion, /listeners, /family, /reminders, /send-later

  Note: admin and listener are separate capabilities. The CRM is gated on the
  admin role, the softphone on an active call_agents row. If you want one login
  that does both, add an admin role row for the listener user too.

  Remove them again with:  node scripts/seed-dev-users.mjs --destroy --yes-write-to-hosted
`);
}

/* -------------------------------------------------------------------------- */
/* Verify                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Attempts a real sign-in for each seed account using the publishable key —
 * the exact path the browser takes. This distinguishes the three failures that
 * all surface as "Invalid login credentials" in the UI:
 *   - the account does not exist (seed never actually ran)
 *   - the account exists but the password differs (shell mangled it)
 *   - the account exists and the email is unconfirmed
 */
async function runVerify() {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!publishable) die("SUPABASE_PUBLISHABLE_KEY is not set; cannot test sign-in.");

  console.log(`\n  Verifying sign-in against ${SUPABASE_URL}`);
  console.log(`  Password the script received: ${await fingerprint(PASSWORD)}\n`);

  const anon = createClient(SUPABASE_URL, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let anyFailed = false;

  for (const seed of SEEDS) {
    const { data, error } = await anon.auth.signInWithPassword({
      email: seed.email,
      password: PASSWORD,
    });

    if (error) {
      anyFailed = true;
      console.log(`  ✗ ${seed.email.padEnd(30)} ${error.message}`);
      continue;
    }

    const u = data.user;
    const confirmed = Boolean(u?.email_confirmed_at ?? u?.confirmed_at);
    console.log(
      `  ✓ ${seed.email.padEnd(30)} signed in  id=${u.id.slice(0, 8)}…  confirmed=${confirmed}`,
    );
    await anon.auth.signOut();
  }

  if (anyFailed) {
    console.log(`
  ─────────────────────────────────────────────────────────────
  "Invalid login credentials" means one of three things:

  1. The account does not exist. The seed may have exited on a guard.
     Re-run it and read the output:
       npm run seed:users -- --yes-write-to-hosted

  2. The password differs from the one you are typing. Almost always the
     shell, not the script. In PowerShell, a '$' inside DOUBLE quotes
     interpolates, so "Pa\$\$w0rd1234" reaches node as "Paw0rd1234".
     Use SINGLE quotes for anything containing $ ! or \`:
       $env:SEED_PASSWORD='Pa$$w0rd1234'
     Then re-seed, and check the fingerprint above matches between the
     seed run and this verify run.

  3. Email unconfirmed. The seed passes email_confirm: true, so this
     should not happen — if confirmed=false above, tell me.

  Note: the password is only ever set by the seed. Changing SEED_PASSWORD
  and NOT re-seeding will always fail.
`);
    process.exit(1);
  }

  console.log("\n  All three accounts sign in. Use these exact values at /auth.\n");
}

try {
  if (verify) await runVerify();
  else if (destroy) await runDestroy();
  else await runSeed();
} catch (err) {
  die(err instanceof Error ? err.message : String(err));
}
