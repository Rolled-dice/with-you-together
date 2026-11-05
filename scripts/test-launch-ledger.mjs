// Isolated PostgreSQL tests; never reads .env or connects to a hosted project.
// Pass an installed @electric-sql/pglite module path to keep test tooling outside app dependencies.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { LAUNCH_CATALOG_VERSION, LAUNCH_MARKETS, LAUNCH_PLANS } from "../src/lib/launch-catalog.ts";

const { PGlite } = await import(
  process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : "@electric-sql/pglite"
);
const db = new PGlite();
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = uid(1),
  member = uid(2),
  stranger = uid(3),
  otherOwner = uid(4);
const family = uid(11),
  account = uid(21),
  plusAccount = uid(22);
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const command = async (actor, action, booking = null, pool = account) =>
  (
    await query("select public.launch_call_command($1, $2, $3, $4) as result", [
      actor,
      pool,
      action,
      booking,
    ])
  )[0].result;
const grant = async (event, phase, start, end, paid = null, pool = account) =>
  (
    await query("select public.launch_issue_call_grant($1, $2, $3, $4, $5, $6) as id", [
      pool,
      event,
      phase,
      start,
      end,
      paid,
    ])
  )[0].id;
const now = Date.now();
const at = (hours) => new Date(now + hours * 3_600_000).toISOString();
async function booking(n, user = owner) {
  const id = uid(100 + n);
  await query("insert into public.listener_bookings(id,user_id) values ($1,$2)", [id, user]);
  return id;
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.families(id uuid primary key, owner_id uuid references auth.users(id));
    create table public.family_members(id uuid primary key default gen_random_uuid(), family_id uuid references public.families(id), user_id uuid references auth.users(id));
    create table public.family_invitations(id uuid primary key default gen_random_uuid(), family_id uuid references public.families(id), status text not null default 'pending', expires_at timestamptz not null);
    create table public.listener_bookings(id uuid primary key, user_id uuid references auth.users(id));
    grant usage on schema public to service_role;
    grant select on public.families, public.family_members, public.listener_bookings to service_role;
    grant insert on public.listener_bookings to service_role;
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261104061149_launch_shared_call_ledger.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );

  await check("SQL catalog matches all 38 approved market/plan combinations", async () => {
    const prices = await query("select * from public.launch_catalog_prices");
    assert.equal(prices.length, 38);
    for (const market of LAUNCH_MARKETS)
      for (const [plan, terms] of Object.entries(LAUNCH_PLANS)) {
        const row = prices.find((x) => x.market === market.id && x.plan === plan);
        assert.deepEqual(
          [
            row.catalog_version,
            row.currency,
            row.amount_minor,
            row.people,
            row.monthly_calls,
            row.trial_calls,
          ],
          [
            LAUNCH_CATALOG_VERSION,
            market.currency,
            market[plan],
            terms.people,
            terms.calls,
            terms.trialCalls,
          ],
        );
      }
  });
  await check(
    "anon/authenticated cannot read ledger tables or execute actor-parameter commands",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        await assert.rejects(
          query("select * from public.launch_billing_accounts"),
          /permission denied/,
        );
        await assert.rejects(command(owner, "snapshot"), /permission denied/);
        await assert.rejects(grant("bad", "trial", at(-1), at(167)), /permission denied/);
        await db.exec("reset role");
      }
      const rls = await query(
        "select relrowsecurity from pg_class where relname in ('launch_catalog_prices','launch_billing_accounts','launch_call_grants','launch_call_reservations')",
      );
      assert.equal(rls.length, 4);
      assert(rls.every((row) => row.relrowsecurity));
    },
  );
  await check("published catalog cannot be rewritten", async () => {
    await assert.rejects(
      query("update public.launch_catalog_prices set amount_minor = 1 where market = 'us'"),
      /immutable/,
    );
  });
  await query("insert into auth.users(id) values ($1),($2),($3),($4)", [
    owner,
    member,
    stranger,
    otherOwner,
  ]);
  await query("insert into public.families(id,owner_id) values ($1,$2)", [family, owner]);
  await query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
    family,
    owner,
  ]);
  await query(
    `insert into public.launch_billing_accounts(id, owner_id, family_id, environment, provider_subscription_id,catalog_version,market,plan)
    values ($1,$2,$3,'live','sub-care','2026-11-launch','in','care')`,
    [account, owner, family],
  );
  await query(
    `insert into public.launch_billing_accounts(id, owner_id, environment, provider_subscription_id,catalog_version,market,plan)
    values ($1,$2,'live','sub-plus','2026-11-launch','kh','care_plus')`,
    [plusAccount, otherOwner],
  );
  await check("account binding rejects another family owner and plan reassignment", async () => {
    await assert.rejects(
      query("update public.launch_billing_accounts set family_id=$1 where id=$2", [
        family,
        plusAccount,
      ]),
      /family owner/,
    );
    await assert.rejects(
      query("update public.launch_billing_accounts set plan='care_plus' where id=$1", [account]),
      /cannot be reassigned/,
    );
  });
  await db.exec("set role service_role");
  const trialId = await grant("trial-1", "trial", at(-1), at(167));
  await check(
    "seven-day Care trial has four calls and excludes the fifth shared reservation",
    async () => {
      assert.equal((await command(owner, "snapshot")).remainingCalls, 4);
      for (let n = 1; n <= 4; n++) await command(owner, "reserve", await booking(n));
      await assert.rejects(command(owner, "reserve", await booking(5)), /exhausted/);
      assert.equal((await command(owner, "snapshot")).remainingCalls, 0);
    },
  );
  await check(
    "duplicate reservation and webhook delivery do not consume or reset allowances",
    async () => {
      await command(owner, "reserve", uid(101));
      assert.equal(await grant("trial-1", "trial", at(-1), at(167)), trialId);
      assert.equal(await grant("trial-duplicate-delivery", "trial", at(-1), at(167)), trialId);
      assert.equal((await command(owner, "snapshot")).usedCalls, 4);
      await assert.rejects(grant("trial-1", "trial", at(-2), at(166)), /Conflicting/);
    },
  );
  await check(
    "release is idempotent; consumed calls cannot be refunded through release",
    async () => {
      await command(owner, "release", uid(101));
      await command(owner, "release", uid(101));
      assert.equal((await command(owner, "snapshot")).remainingCalls, 1);
      await command(owner, "reserve", uid(105));
      await command(owner, "consume", uid(105));
      await command(owner, "consume", uid(105));
      await assert.rejects(command(owner, "release", uid(105)), /Consumed calls/);
      await assert.rejects(command(owner, "reserve", uid(101)), /Released booking/);
    },
  );
  await check(
    "owner and family member share one pool; strangers cannot inspect or spend it",
    async () => {
      await db.exec("reset role");
      await query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
        family,
        member,
      ]);
      await db.exec("set role service_role");
      assert.equal((await command(member, "snapshot")).usedCalls, 4);
      assert(!Object.hasOwn(await command(member, "snapshot"), "refundDeadline"));
      await assert.rejects(command(stranger, "snapshot"), /unavailable/);
      await assert.rejects(command(member, "consume", uid(105)), /Booking unavailable/);
    },
  );
  await check(
    "paid Care gets a fresh 15-call grant and refund deadline follows actual charge",
    async () => {
      await grant("payment-1", "paid", at(-0.5), at(720), at(-0.5));
      const snapshot = await command(owner, "snapshot");
      assert.equal(snapshot.phase, "paid");
      assert.equal(snapshot.totalCalls, 15);
      assert.equal(snapshot.remainingCalls, 15);
      assert.equal(
        new Date(snapshot.refundDeadline).getTime(),
        Date.parse(at(-0.5)) + 168 * 3_600_000,
      );
      await assert.rejects(grant("restart", "trial", at(200), at(368)), /restart a trial/);
      await assert.rejects(grant("unpaid", "paid", at(721), at(1441)), /successful charge/);
    },
  );
  await check(
    "member bookings spend the paid shared pool and queued requests cannot overdraw",
    async () => {
      const ids = [];
      for (let n = 10; n < 30; n++) ids.push(await booking(n, member));
      const results = await Promise.allSettled(ids.map((id) => command(member, "reserve", id)));
      assert.equal(results.filter((x) => x.status === "fulfilled").length, 15);
      assert.equal(results.filter((x) => x.status === "rejected").length, 5);
      assert.equal((await command(owner, "snapshot")).remainingCalls, 0);
    },
  );
  await check("renewals cannot overlap or extend first-charge refund eligibility", async () => {
    await assert.rejects(grant("overlap", "paid", at(1), at(730), at(-0.1)), /Overlapping/);
    await grant("renewal", "paid", at(720), at(1440), at(-0.1));
    assert.equal(
      new Date((await command(owner, "snapshot")).refundDeadline).getTime(),
      Date.parse(at(-0.5)) + 168 * 3_600_000,
    );
    assert.equal((await command(owner, "snapshot")).remainingCalls, 0);
    await assert.rejects(
      query("update public.launch_billing_accounts set first_successful_charge_at=$1 where id=$2", [
        at(-0.1),
        account,
      ]),
      /cannot be cleared or moved forward/,
    );
    await assert.rejects(
      query(
        "update public.launch_billing_accounts set first_successful_charge_at=null where id=$1",
        [account],
      ),
      /cannot be cleared or moved forward/,
    );
  });
  await check("Care Plus trial and paid periods have seven and thirty calls", async () => {
    await grant("plus-trial", "trial", at(-2), at(166), null, plusAccount);
    assert.equal((await command(otherOwner, "snapshot", null, plusAccount)).totalCalls, 7);
    await grant("plus-payment", "paid", at(-1), at(719), at(-1), plusAccount);
    assert.equal((await command(otherOwner, "snapshot", null, plusAccount)).totalCalls, 30);
  });
  await check("suspended paid accounts cannot reserve calls", async () => {
    await db.exec("reset role");
    await query("update public.launch_billing_accounts set status='suspended' where id=$1", [
      account,
    ]);
    await db.exec("set role service_role");
    await assert.rejects(command(owner, "reserve", await booking(40)), /inactive/);
    assert.equal((await command(owner, "snapshot")).remainingCalls, 0);
    await db.exec("reset role");
    await query("update public.launch_billing_accounts set status='active' where id=$1", [account]);
  });
  await check("Care family caps include owner and pending unexpired invitations", async () => {
    await assert.rejects(
      query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
        family,
        stranger,
      ]),
      /capacity/,
    );
    await assert.rejects(
      query("insert into public.family_invitations(family_id,expires_at) values ($1,$2)", [
        family,
        at(24),
      ]),
      /capacity/,
    );
    await query("delete from public.family_members where family_id=$1 and user_id=$2", [
      family,
      member,
    ]);
    const invitation = (
      await query(
        "insert into public.family_invitations(family_id,expires_at) values ($1,$2) returning id",
        [family, at(24)],
      )
    )[0].id;
    await assert.rejects(
      query(
        "insert into public.family_invitations(family_id,status,expires_at) values ($1,'verification_pending',$2)",
        [family, at(24)],
      ),
      /capacity/,
    );
    // Existing verification flow may join before marking the matching invite accepted.
    await query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
      family,
      member,
    ]);
    await query("update public.family_invitations set status='accepted' where id=$1", [invitation]);
    await query("insert into public.family_invitations(family_id,expires_at) values ($1,$2)", [
      family,
      at(-1),
    ]);
  });
  await check("new seat triggers leave legacy families unchanged", async () => {
    const legacy = uid(12);
    await query("insert into public.families(id,owner_id) values ($1,$2)", [legacy, stranger]);
    for (const user of [owner, member, stranger, otherOwner])
      await query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
        legacy,
        user,
      ]);
    assert.equal(
      (
        await query(
          "select count(*)::integer as count from public.family_members where family_id=$1",
          [legacy],
        )
      )[0].count,
      4,
    );
  });
  await check(
    "expired trial denies bookings; late first payment still starts a full refund window",
    async () => {
      const expired = uid(23);
      await query(
        `insert into public.launch_billing_accounts(id, owner_id, environment, provider_subscription_id,catalog_version,market,plan)
      values ($1,$2,'live','sub-delayed','2026-11-launch','us','care')`,
        [expired, stranger],
      );
      await db.exec("set role service_role");
      await grant("old-trial", "trial", at(-200), at(-32), null, expired);
      assert.equal((await command(stranger, "snapshot", null, expired)).remainingCalls, 0);
      await assert.rejects(
        command(stranger, "reserve", await booking(50, stranger), expired),
        /No current call allowance/,
      );
      await grant("late-payment", "paid", at(-1), at(719), at(-1), expired);
      const allowance = await command(stranger, "snapshot", null, expired);
      assert.equal(allowance.remainingCalls, 15);
      assert.equal(
        new Date(allowance.refundDeadline).getTime(),
        Date.parse(at(-1)) + 168 * 3_600_000,
      );
      await db.exec("reset role");
    },
  );
  await check("Care Plus permits five people including owner and rejects the sixth", async () => {
    const plusFamily = uid(13);
    await query("insert into public.families(id,owner_id) values ($1,$2)", [
      plusFamily,
      otherOwner,
    ]);
    await query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
      plusFamily,
      otherOwner,
    ]);
    await query("update public.launch_billing_accounts set family_id=$1 where id=$2", [
      plusFamily,
      plusAccount,
    ]);
    for (let n = 5; n <= 9; n++) await query("insert into auth.users(id) values ($1)", [uid(n)]);
    for (let n = 5; n <= 8; n++)
      await query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
        plusFamily,
        uid(n),
      ]);
    await assert.rejects(
      query("insert into public.family_members(family_id,user_id) values ($1,$2)", [
        plusFamily,
        uid(9),
      ]),
      /capacity/,
    );
    assert.equal(
      (
        await query(
          "select count(*)::integer as count from public.family_members where family_id=$1",
          [plusFamily],
        )
      )[0].count,
      5,
    );
  });
  await check("test/live accounts and provider event IDs remain separate", async () => {
    const testAccount = uid(24);
    await query(
      `insert into public.launch_billing_accounts(id, owner_id, environment, provider_subscription_id,catalog_version,market,plan)
      values ($1,$2,'test','sub-care','2026-11-launch','us','care')`,
      [testAccount, owner],
    );
    await db.exec("set role service_role");
    await grant("trial-1", "trial", at(-1), at(167), null, testAccount);
    assert.equal((await command(owner, "snapshot", null, testAccount)).remainingCalls, 4);
    assert.equal((await command(owner, "snapshot")).remainingCalls, 0);
    await assert.rejects(command(null, "snapshot", null, testAccount), /unavailable/);
    await db.exec("reset role");
  });
  console.log(
    `Completed ${checks} isolated PostgreSQL checks. No hosted database or provider calls.`,
  );
} catch (error) {
  console.error(`FAIL after ${checks} checks: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
