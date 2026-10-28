// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "10000000-0000-4000-8000-000000000001";
const parent = "10000000-0000-4000-8000-000000000002";
const agent = "10000000-0000-4000-8000-000000000003";
const stranger = "10000000-0000-4000-8000-000000000004";
const admin = "10000000-0000-4000-8000-000000000005";
let db: PGlite;
const sql = (name: string) => readFileSync(resolve("supabase/migrations", name), "utf8");
async function command(actor: string, action: string, data: object = {}, fn = "family_command") {
  const result = await db.query<{ result: Record<string, unknown> }>(
    `select public.${fn}($1,$2,$3::jsonb) as result`,
    [actor, action, JSON.stringify(data)],
  );
  return result.rows[0].result;
}
async function invite() {
  await command(owner, "create", { name: "Our family" });
  const result = await command(owner, "invite", {
    contact_channel: "email",
    email: "parent@example.test",
    invitee_name: "Dad",
    relationship: "Father",
    call_timezone: "Asia/Kolkata",
  });
  const { rows } = await db.query<{ token: string }>(
    "select token from family_invitations where id=$1",
    [result.id],
  );
  return { id: result.id as string, token: rows[0].token };
}
async function accepted() {
  const request = await invite();
  await command(parent, "accept", {
    token: request.token,
    display_name: "Dad",
    call_phone: "+919876543210",
    call_window: "Weekdays 10 to 12",
    call_timezone: "Asia/Kolkata",
    adult_confirmed: true,
    receive_reminders: false,
    share_updates: false,
    share_health: false,
  });
  return request;
}
async function activated() {
  const request = await accepted();
  await command(agent, "claim_verification", { id: request.id });
  await command(agent, "verify", {
    id: request.id,
    attempt_id: crypto.randomUUID(),
    outcome: "verified",
    consent_confirmed: true,
  });
  return request;
}
async function browser(actor: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
  await db.exec("set local role authenticated");
}
async function resetBrowser() {
  await db.exec("reset role; select set_config('request.jwt.claim.sub','',true)");
}
beforeAll(async () => {
  db = new PGlite();
  // Supabase infrastructure fixture. All product policies and functions below are real migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    grant usage on schema auth,public,storage to authenticated,anon,service_role;
    create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(repeat(replace(gen_random_uuid()::text,'-',''),n/16+1),'hex') $$;
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    create table auth.users(id uuid primary key,email text,phone text,email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
    create table public.profiles(id uuid primary key references auth.users,display_name text,timezone text default 'Asia/Kolkata',care_tier text default 'free',care_status text default 'inactive',care_since timestamptz,phone text,phone_verified boolean default false);
    grant select,update,insert on public.profiles to authenticated;
    create table public.user_roles(user_id uuid,role text);
    create function public.has_role(_user_id uuid,_role text) returns boolean language sql as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
    create table public.call_agents(id uuid default gen_random_uuid(),user_id uuid,is_active boolean);
    create table storage.objects(id uuid default gen_random_uuid(),name text,bucket_id text);
    grant select on storage.objects to authenticated;
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    create table public.listener_bookings(id uuid primary key default gen_random_uuid(),user_id uuid,listener_id uuid,requested_at timestamptz,duration_minutes integer default 15,note text,status text default 'requested');
    grant select,insert,update,delete on public.listener_bookings to authenticated;
    create table public.family_session_pool(family_id uuid,period_start date,total_sessions integer default 0,reschedules_total integer default 0,reschedules_used integer default 0,primary key(family_id,period_start));
    create table public.family_session_allocations(family_id uuid,member_user_id uuid,period_start date,allocated integer default 0,used integer default 0,primary key(family_id,member_user_id,period_start));
    create table public.solo_session_usage(user_id uuid,period_start date,sessions_used integer default 0,reschedules_used integer default 0,primary key(user_id,period_start));
    create table public.subscriptions(id uuid default gen_random_uuid(),user_id uuid,status text,current_period_end timestamptz);
    create table public.notifications(id uuid default gen_random_uuid() primary key,user_id uuid references auth.users,kind text,severity text,title text,body text);
  `);
  for (const name of [
    "20260721035023_ab9dddaa-9bde-4c2e-a076-486382db2665.sql",
    "20260722070431_da7ece36-36c5-424a-815f-08c0c7b1bd92.sql",
    "20261003100000_family_consent_and_verification.sql",
    "20261003110000_family_reminder_occurrences.sql",
    "20261003120000_atomic_call_credits.sql",
    "20260913075402_f426e7e2-0e9c-4a65-a727-97d49ad99471.sql",
    "20261003130000_family_delivery.sql",
    "20261003140000_family_identity_guards.sql",
  ])
    await db.exec(sql(name));
}, 60000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin");
  for (const [id, email, tier] of [
    [owner, "owner@example.test", "care_plus"],
    [parent, "parent@example.test", "free"],
    [agent, "agent@example.test", "free"],
    [stranger, "stranger@example.test", "free"],
    [admin, "admin@example.test", "free"],
  ]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [
      id,
      email,
    ]);
    await db.query(
      "insert into profiles(id,display_name,care_tier,phone,phone_verified) values($1,$2,$3,'+919876543210',true)",
      [id, email, tier],
    );
  }
  await db.query("insert into call_agents(user_id,is_active) values($1,true)", [agent]);
  await db.query("insert into user_roles(user_id,role) values($1,'admin')", [admin]);
});
afterEach(async () => {
  await db.exec("rollback");
});

describe("family consent and verification transactions", () => {
  it("passes the deployable permission verification script", async () => {
    await db.exec(readFileSync(resolve("supabase/tests/family_permissions.sql"), "utf8"));
  });
  it("does not activate membership or benefits when the recipient accepts", async () => {
    await accepted();
    expect(
      (await db.query("select * from family_members where user_id=$1", [parent])).rows,
    ).toHaveLength(0);
    expect((await command(parent, "snapshot")).pending).toHaveLength(1);
  });
  it("activates once after assigned staff confirms consent; sharing starts off", async () => {
    const request = await accepted();
    await command(agent, "claim_verification", { id: request.id });
    const payload = {
      id: request.id,
      attempt_id: crypto.randomUUID(),
      outcome: "verified",
      consent_confirmed: true,
    };
    await command(agent, "verify", payload);
    await command(agent, "verify", payload);
    expect(
      (await db.query("select * from family_members where user_id=$1", [parent])).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ share_health: boolean }>(
          "select share_health from family_sharing where user_id=$1",
          [parent],
        )
      ).rows[0].share_health,
    ).toBe(false);
  });
  it("rejects a different account using the invite token", async () => {
    const request = await invite();
    await expect(command(stranger, "lookup", { token: request.token })).rejects.toThrow(
      /Sign in with/,
    );
  });
  it("does not count technical failures and closes exactly after three unanswered calls", async () => {
    const request = await accepted();
    await command(agent, "claim_verification", { id: request.id });
    await command(agent, "verify", {
      id: request.id,
      attempt_id: crypto.randomUUID(),
      outcome: "technical_failure",
    });
    for (let n = 0; n < 3; n++)
      await command(agent, "verify", {
        id: request.id,
        attempt_id: crypto.randomUUID(),
        outcome: "no_answer",
      });
    const result = (
      await db.query<{ status: string; attempts: number }>(
        "select status,attempts from family_invitations where id=$1",
        [request.id],
      )
    ).rows[0];
    expect(result).toEqual({ status: "verification_closed", attempts: 3 });
    await command(admin, "reopen", {
      id: request.id,
      attempt_id: crypto.randomUUID(),
      recipient_requested: true,
      note: "Recipient called support and requested another attempt.",
    });
    expect(
      (
        await db.query<{ attempts: number }>(
          "select attempts from family_invitations where id=$1",
          [request.id],
        )
      ).rows[0].attempts,
    ).toBe(0);
    expect(
      (
        await db.query("select * from family_verification_attempts where invitation_id=$1", [
          request.id,
        ])
      ).rows,
    ).toHaveLength(5);
  });
  it("reserves pending places and rejects the sixth person", async () => {
    await command(owner, "create", { name: "Family" });
    for (let n = 0; n < 4; n++)
      await command(owner, "invite", {
        contact_channel: "email",
        email: `member${n}@example.test`,
        invitee_name: "Relative",
        relationship: "Relative",
        call_timezone: "UTC",
      });
    await expect(
      command(owner, "invite", {
        contact_channel: "email",
        email: "sixth@example.test",
        invitee_name: "Relative",
        relationship: "Relative",
        call_timezone: "UTC",
      }),
    ).rejects.toThrow(/five family places/);
  });
  it("does not grant adult members owner powers", async () => {
    await activated();
    await expect(command(parent, "rename", { name: "Changed" })).rejects.toThrow(
      /Only the family owner/,
    );
  });
  it("denies browser roles access to privileged RPCs and membership writes", async () => {
    const rows = (
      await db.query<{ allowed: boolean }>(
        "select has_function_privilege('authenticated','family_command(uuid,text,jsonb)','execute') or has_table_privilege('authenticated','family_members','insert') as allowed",
      )
    ).rows;
    expect(rows[0].allowed).toBe(false);
  });
  it("sharing can only be changed by its subject and is revoked immediately", async () => {
    await activated();
    expect(
      (
        await db.query<{ ok: boolean }>("select family_can_access($1,$2,'health') as ok", [
          owner,
          parent,
        ])
      ).rows[0].ok,
    ).toBe(false);
    await command(parent, "sharing", {
      receive_reminders: true,
      share_updates: true,
      share_health: true,
    });
    expect(
      (
        await db.query<{ ok: boolean }>("select family_can_access($1,$2,'health') as ok", [
          owner,
          parent,
        ])
      ).rows[0].ok,
    ).toBe(true);
    await command(parent, "sharing", {
      receive_reminders: false,
      share_updates: false,
      share_health: false,
    });
    expect(
      (
        await db.query<{ ok: boolean }>("select family_can_access($1,$2,'health') as ok", [
          owner,
          parent,
        ])
      ).rows[0].ok,
    ).toBe(false);
  });
  it("preserves a legacy Care family without allowing expansion", async () => {
    await activated();
    await db.query("update profiles set care_tier='care' where id=$1", [owner]);
    expect((await command(owner, "snapshot")).members).toHaveLength(2);
    await expect(
      command(owner, "invite", {
        contact_channel: "email",
        email: "new@example.test",
        invitee_name: "Relative",
        relationship: "Relative",
        call_timezone: "UTC",
      }),
    ).rejects.toThrow(/Care Plus/);
  });
  it.each(["expired", "revoked", "declined"])(
    "does not activate a %s invitation",
    async (state) => {
      const request = await accepted();
      if (state === "expired")
        await db.query(
          "update family_invitations set expires_at=now()-interval '1 second' where id=$1",
          [request.id],
        );
      else
        await db.query("update family_invitations set status=$2 where id=$1", [request.id, state]);
      await expect(command(agent, "claim_verification", { id: request.id })).rejects.toThrow(
        /no longer open/,
      );
    },
  );
  it("rejects duplicate invitations without freeing a reserved place", async () => {
    await invite();
    await expect(
      command(owner, "invite", {
        contact_channel: "email",
        email: "parent@example.test",
        invitee_name: "Dad",
        relationship: "Father",
        call_timezone: "UTC",
      }),
    ).rejects.toThrow(/invitation already exists/);
  });
  it("accepts a phone invitation only for the account with that confirmed Auth phone", async () => {
    await command(owner, "create", { name: "Family" });
    const invitation = await command(owner, "invite", {
      contact_channel: "sms",
      contact_phone: "+919876543210",
      invitee_name: "Dad",
      relationship: "Father",
      call_timezone: "UTC",
    });
    await db.query(
      "update auth.users set email=null,phone='919876543210',phone_confirmed_at=now() where id=$1",
      [parent],
    );
    const token = (
      await db.query<{ token: string }>("select token from family_invitations where id=$1", [
        invitation.id,
      ])
    ).rows[0].token;
    await command(parent, "accept", {
      token,
      display_name: "Dad",
      call_phone: "+919876543210",
      call_window: "Morning",
      call_timezone: "UTC",
      adult_confirmed: true,
    });
    expect(
      (
        await db.query<{ recipient_id: string }>(
          "select recipient_id from family_invitations where id=$1",
          [invitation.id],
        )
      ).rows[0].recipient_id,
    ).toBe(parent);
    expect(
      (await db.query("select * from family_members where user_id=$1", [parent])).rows,
    ).toHaveLength(0);
  });
  it("does not treat a matching profile contact as Auth verification", async () => {
    await command(owner, "create", { name: "Family" });
    const invitation = await command(owner, "invite", {
      contact_channel: "sms",
      contact_phone: "+919876543210",
      invitee_name: "Dad",
      relationship: "Father",
      call_timezone: "UTC",
    });
    const token = (
      await db.query<{ token: string }>("select token from family_invitations where id=$1", [
        invitation.id,
      ])
    ).rows[0].token;
    await expect(command(parent, "lookup", { token })).rejects.toThrow(/Sign in with/);
  });
  it("hides unclaimed contact details and does not let staff override sharing choices", async () => {
    const request = await accepted();
    const queue = (await command(agent, "verification_queue")) as {
      rows: { call_phone: string | null }[];
    };
    expect(queue.rows[0].call_phone).toBeNull();
    await command(agent, "claim_verification", { id: request.id });
    await command(agent, "verify", {
      id: request.id,
      attempt_id: crypto.randomUUID(),
      outcome: "verified",
      consent_confirmed: true,
      share_health: true,
      receive_reminders: true,
    });
    expect(
      (
        await db.query<{ share_health: boolean; receive_reminders: boolean }>(
          "select share_health,receive_reminders from family_sharing where user_id=$1",
          [parent],
        )
      ).rows[0],
    ).toEqual({ share_health: false, receive_reminders: false });
  });
  it("stops further verification attempts immediately after refusal", async () => {
    const request = await accepted();
    await command(agent, "claim_verification", { id: request.id });
    await command(agent, "verify", {
      id: request.id,
      attempt_id: crypto.randomUUID(),
      outcome: "declined",
    });
    expect(
      (
        await db.query<{ attempts: number }>(
          "select attempts from family_invitations where id=$1",
          [request.id],
        )
      ).rows[0].attempts,
    ).toBe(0);
    await expect(
      command(agent, "verify", {
        id: request.id,
        attempt_id: crypto.randomUUID(),
        outcome: "no_answer",
      }),
    ).rejects.toThrow(/no longer open/);
  });
  it("does not allow browsers to promote a plan or assert phone verification", async () => {
    await browser(parent);
    await expect(
      db.query("update profiles set care_tier='care_plus' where id=$1", [parent]),
    ).rejects.toThrow(/managed by billing/);
  });
  it("does not allow browsers to mark a new phone as verified", async () => {
    await browser(parent);
    await expect(
      db.query("update profiles set phone='+919876543211',phone_verified=true where id=$1", [
        parent,
      ]),
    ).rejects.toThrow(/Verify your phone/);
  });
});

describe("reminder occurrences", () => {
  it.each(["withdraw", "remove", "leave"])(
    "stops future family reminders after %s while keeping personal reminders",
    async (action) => {
      const request = await activated();
      await command(parent, "sharing", {
        receive_reminders: true,
        share_updates: true,
        share_health: true,
      });
      const details = {
        for_user_id: parent,
        title: "Doctor",
        due_at: new Date(Date.now() + 3600000).toISOString(),
        timezone: "UTC",
        recurrence: "daily",
      };
      const familyReminder = await command(owner, "create", details, "family_reminder_command");
      const personalReminder = await command(parent, "create", details, "family_reminder_command");
      await command(
        parent,
        "subscribe",
        { endpoint: "https://fcm.googleapis.com/test", p256dh: "key", auth: "secret" },
        "push_command",
      );
      await db.query(
        "insert into reminder_push_jobs(device_id,occurrence_id,due_at) select d.id,o.id,o.due_at from push_devices d,reminder_occurrences o where o.reminder_id=$1",
        [familyReminder.id],
      );
      if (action === "withdraw")
        await command(parent, "sharing", {
          receive_reminders: false,
          share_updates: false,
          share_health: false,
        });
      else if (action === "leave") await command(parent, "leave");
      else {
        const member = (
          await db.query<{ id: string }>("select id from family_members where user_id=$1", [parent])
        ).rows[0];
        await command(owner, "remove", { member_id: member.id });
      }
      expect(
        (
          await db.query<{ status: string }>("select status from reminders where id=$1", [
            familyReminder.id,
          ])
        ).rows[0].status,
      ).toBe("dismissed");
      expect(
        (
          await db.query<{ status: string }>("select status from reminders where id=$1", [
            personalReminder.id,
          ])
        ).rows[0].status,
      ).toBe("pending");
      expect(
        (await db.query<{ state: string }>("select state from reminder_push_jobs")).rows[0].state,
      ).toBe("cancelled");
      if (action !== "withdraw")
        expect(
          (
            await db.query<{ status: string }>(
              "select status from family_invitations where id=$1",
              [request.id],
            )
          ).rows[0].status,
        ).toBe("revoked");
    },
  );
  it("requires consent to create a reminder for a parent", async () => {
    await activated();
    await expect(
      command(
        owner,
        "create",
        {
          for_user_id: parent,
          title: "Doctor",
          due_at: new Date(Date.now() + 3600000).toISOString(),
          timezone: "Asia/Kolkata",
        },
        "family_reminder_command",
      ),
    ).rejects.toThrow(/not enabled reminders/);
  });
  it("keeps updates private when only receiving reminders is enabled", async () => {
    await activated();
    await command(parent, "sharing", {
      receive_reminders: true,
      share_updates: false,
      share_health: false,
    });
    const reminder = await command(
      owner,
      "create",
      {
        for_user_id: parent,
        title: "Doctor",
        due_at: new Date(Date.now() + 3600000).toISOString(),
        timezone: "Asia/Kolkata",
      },
      "family_reminder_command",
    );
    const occurrence = (
      await db.query<{ id: string }>("select id from reminder_occurrences where reminder_id=$1", [
        reminder.id,
      ])
    ).rows[0];
    await command(parent, "complete", occurrence, "family_reminder_command");
    await command(
      parent,
      "update",
      { ...occurrence, update_text: "Private note" },
      "family_reminder_command",
    );
    const result = (await command(owner, "today", {}, "family_reminder_command")) as unknown as {
      status: string;
      update_text: string | null;
    }[];
    expect(result[0]).toMatchObject({ status: "no_update", update_text: null });
  });
  it("anchors recurring local time across DST and preserves the recurring schedule", async () => {
    await db.query(
      "insert into reminders(for_user_id,created_by,title,due_at,next_occurrence_at,timezone,recurrence) values($1,$1,'Daily','2026-03-07T14:00:00Z','2026-03-07T14:00:00Z','America/New_York','daily')",
      [parent],
    );
    await db.exec("select materialize_reminder_occurrences()");
    const next = (
      await db.query<{ local: string }>(
        "select to_char(next_occurrence_at at time zone timezone,'HH24:MI') as local from reminders",
      )
    ).rows[0];
    expect(next.local).toBe("09:00");
  });
});

describe("prescription access", () => {
  it("lets recipients manage legacy medications entered by another family member", async () => {
    const medication = (
      await db.query<{ id: string }>(
        "insert into medications(for_user_id,added_by,name) values($1,$2,'Legacy medicine') returning id",
        [parent, owner],
      )
    ).rows[0];
    await browser(parent);
    await db.query("update medications set is_active=false where id=$1", [medication.id]);
    expect(
      (
        await db.query<{ is_active: boolean }>("select is_active from medications where id=$1", [
          medication.id,
        ])
      ).rows[0].is_active,
    ).toBe(false);
  });
  it("enforces health consent and its withdrawal on direct medication and file reads", async () => {
    await activated();
    const path = `${parent}/prescription.jpg`;
    await db.query(
      "insert into medications(for_user_id,added_by,name,prescription_image_path) values($1,$1,'Private medicine',$2)",
      [parent, path],
    );
    await db.query("insert into storage.objects(bucket_id,name) values('prescriptions',$1)", [
      path,
    ]);
    await browser(owner);
    expect((await db.query("select * from medications")).rows).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
    await resetBrowser();
    await command(parent, "sharing", {
      receive_reminders: false,
      share_updates: false,
      share_health: true,
    });
    await browser(owner);
    expect((await db.query("select * from medications")).rows).toHaveLength(1);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(1);
    await resetBrowser();
    await command(parent, "sharing", {
      receive_reminders: false,
      share_updates: false,
      share_health: false,
    });
    await browser(owner);
    expect((await db.query("select * from medications")).rows).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
  });
  it("cannot expose another account's file by attaching its path to a personal medication", async () => {
    await browser(owner);
    await expect(
      db.query(
        "insert into medications(for_user_id,added_by,name,prescription_image_path) values($1,$1,'Private medicine',$2)",
        [owner, `${parent}/prescription.jpg`],
      ),
    ).rejects.toThrow(/own account/);
  });
});

describe("call credits", () => {
  async function purchased() {
    await db.query(
      "insert into subscriptions(user_id,status,current_period_end) values($1,'active',now()+interval '10 days')",
      [owner],
    );
    await db.query(
      "insert into solo_session_usage(user_id,period_start,sessions_used) values($1,date_trunc('month',now())::date,30)",
      [owner],
    );
    const order = await command(
      owner,
      "order",
      { product_id: "call", currency: "INR", amount: 100, environment: "test" },
      "call_credit_command",
    );
    await command(
      owner,
      "payment",
      {
        order_id: order.id,
        payment_id: "payment-one",
        product_id: "call",
        currency: "INR",
        amount: 100,
        environment: "test",
      },
      "call_credit_command",
    );
    return order;
  }
  it("requires the entire purchased call to fit before expiry", async () => {
    const order = await purchased();
    await expect(
      db.query(
        "insert into listener_bookings(user_id,requested_at,duration_minutes) values($1,$2::timestamptz-interval '5 minutes',15)",
        [owner, order.expires_at],
      ),
    ).rejects.toThrow(/No call sessions/);
  });
  it("does not extend a purchased credit through rescheduling", async () => {
    const order = await purchased();
    const booking = (
      await db.query<{ id: string }>(
        "insert into listener_bookings(user_id,requested_at,duration_minutes) values($1,now()+interval '4 hours',15) returning id",
        [owner],
      )
    ).rows[0];
    await expect(
      db.query("update listener_bookings set requested_at=$2::timestamptz where id=$1", [
        booking.id,
        order.expires_at,
      ]),
    ).rejects.toThrow(/expires before/);
  });
  it("holds delayed payments for review instead of awarding expired credits", async () => {
    await db.query(
      "insert into subscriptions(user_id,status,current_period_end) values($1,'active',now()+interval '10 days')",
      [owner],
    );
    const order = await command(
      owner,
      "order",
      { product_id: "call", currency: "INR", amount: 100, environment: "test" },
      "call_credit_command",
    );
    await db.query(
      "update call_credit_orders set expires_at=now()-interval '1 second' where id=$1",
      [order.id],
    );
    await command(
      owner,
      "payment",
      {
        order_id: order.id,
        payment_id: "payment-late",
        product_id: "call",
        currency: "INR",
        amount: 100,
        environment: "test",
      },
      "call_credit_command",
    );
    expect((await command(owner, "balance", {}, "call_credit_command")).available).toBe(0);
    expect(
      (
        await db.query<{ status: string }>("select status from call_credit_orders where id=$1", [
          order.id,
        ])
      ).rows[0].status,
    ).toBe("review");
  });
  it("reserves a session with the booking and restores it once after timely cancellation", async () => {
    const result = await db.query<{ id: string }>(
      "insert into listener_bookings(user_id,requested_at,duration_minutes,status) values($1,now()+interval '4 hours',15,'confirmed') returning id",
      [owner],
    );
    await db.query("update listener_bookings set status='cancelled' where id=$1", [
      result.rows[0].id,
    ]);
    await db.query("update listener_bookings set status='cancelled' where id=$1", [
      result.rows[0].id,
    ]);
    expect(
      (
        await db.query<{ sessions_used: number }>(
          "select sessions_used from solo_session_usage where user_id=$1",
          [owner],
        )
      ).rows[0].sessions_used,
    ).toBe(0);
  });
  it("rejects bookings once all included calls are reserved", async () => {
    await db.query(
      "insert into solo_session_usage(user_id,period_start,sessions_used) values($1,date_trunc('month',now())::date,30)",
      [owner],
    );
    await expect(
      db.query(
        "insert into listener_bookings(user_id,requested_at,duration_minutes) values($1,now()+interval '4 hours',15)",
        [owner],
      ),
    ).rejects.toThrow(/No call sessions/);
  });
  it("awards one purchased call once, without changing the membership tier", async () => {
    await db.query(
      "insert into subscriptions(user_id,status,current_period_end) values($1,'active',now()+interval '10 days')",
      [owner],
    );
    const order = await command(
      owner,
      "order",
      { product_id: "call", currency: "INR", amount: 100, environment: "test" },
      "call_credit_command",
    );
    const payment = {
      order_id: order.id,
      payment_id: "payment-one",
      product_id: "call",
      currency: "INR",
      amount: 100,
      environment: "test",
    };
    await command(owner, "payment", payment, "call_credit_command");
    await command(owner, "payment", payment, "call_credit_command");
    expect((await command(owner, "balance", {}, "call_credit_command")).available).toBe(1);
    await db.query(
      "update call_credit_orders set expires_at=now()-interval '1 second' where id=$1",
      [order.id],
    );
    expect((await command(owner, "balance", {}, "call_credit_command")).available).toBe(0);
  });
});

describe("private reminder delivery and scheduled messages", () => {
  async function dueReminder() {
    await db.query(
      "insert into reminders(for_user_id,created_by,title,due_at,next_occurrence_at,timezone,recurrence) values($1,$1,'Private doctor visit',now()-interval '1 minute',now()-interval '1 minute','Asia/Kolkata','none')",
      [parent],
    );
    await command(
      parent,
      "subscribe",
      { endpoint: "https://fcm.googleapis.com/test", p256dh: "key", auth: "secret" },
      "push_command",
    );
  }
  it("creates one private inbox item and one push job despite scheduler retries", async () => {
    await dueReminder();
    await db.exec("select prepare_reminder_delivery(); select prepare_reminder_delivery();");
    expect((await db.query("select * from notifications")).rows).toHaveLength(1);
    expect((await db.query("select * from reminder_push_jobs")).rows).toHaveLength(1);
    expect(
      (await db.query<{ body: string }>("select body from notifications")).rows[0].body,
    ).not.toContain("doctor");
  });
  it("leases each push once and cancels retries after completion", async () => {
    await dueReminder();
    await db.exec("select prepare_reminder_delivery()");
    const first = (
      await db.query<{ jobs: { id: string }[] }>("select claim_reminder_push() as jobs")
    ).rows[0].jobs;
    expect(first).toHaveLength(1);
    expect(
      (await db.query<{ jobs: unknown[] }>("select claim_reminder_push() as jobs")).rows[0].jobs,
    ).toHaveLength(0);
    const occurrence = (await db.query<{ id: string }>("select id from reminder_occurrences"))
      .rows[0];
    await command(parent, "complete", occurrence, "family_reminder_command");
    await db.exec("select claim_reminder_push()");
    expect(
      (await db.query<{ state: string }>("select state from reminder_push_jobs")).rows[0].state,
    ).toBe("cancelled");
  });
  it("disabling a device removes pending notifications", async () => {
    await dueReminder();
    await db.exec("select prepare_reminder_delivery()");
    await command(
      parent,
      "disable",
      { endpoint: "https://fcm.googleapis.com/test" },
      "push_command",
    );
    expect((await db.query("select * from reminder_push_jobs")).rows).toHaveLength(0);
  });
  it("denies scheduled messages addressed to unrelated accounts", async () => {
    await expect(
      db.query(
        "insert into scheduled_messages(user_id,recipient_user_id,recipient_name,body,scheduled_at) values($1,$2,'Unknown','Private',now()+interval '1 hour')",
        [owner, stranger],
      ),
    ).rejects.toThrow(/active member/);
  });
  it("keeps message text unavailable until release and deduplicates delivery", async () => {
    await activated();
    const message = (
      await db.query<{ id: string }>(
        "insert into scheduled_messages(user_id,recipient_user_id,recipient_name,body,scheduled_at) values($1,$2,'Dad','Hello',now()+interval '1 hour') returning id",
        [owner, parent],
      )
    ).rows[0];
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [parent]);
    await db.exec("set local role authenticated");
    expect((await db.query("select * from scheduled_messages")).rows).toHaveLength(0);
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',true)");
    await db.query(
      "update scheduled_messages set scheduled_at=now()-interval '1 minute' where id=$1",
      [message.id],
    );
    await db.exec("select deliver_family_messages(); select deliver_family_messages()");
    expect(
      (await db.query("select * from notifications where kind='send_later'")).rows,
    ).toHaveLength(2);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [parent]);
    await db.exec("set local role authenticated");
    expect(
      (await db.query<{ body: string }>("select body from scheduled_messages")).rows[0].body,
    ).toBe("Hello");
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',true)");
  });
  it("prevents browser callers from releasing their own message early", async () => {
    const message = (
      await db.query<{ id: string }>(
        "insert into scheduled_messages(user_id,recipient_name,body,scheduled_at) values($1,'Me','Private',now()+interval '1 hour') returning id",
        [owner],
      )
    ).rows[0];
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
    await db.exec("set local role authenticated");
    await expect(
      db.query("update scheduled_messages set status='delivered',delivered_at=now() where id=$1", [
        message.id,
      ]),
    ).rejects.toThrow(/unchanged scheduled message/);
  });
});
