import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import { loadEnv } from "vite";
import { randomUUID } from "node:crypto";

test.use({ trace: "off", screenshot: "off", actionTimeout: 20000, navigationTimeout: 30000 }); // Synthetic account credentials must not enter traces.
test("authenticated Companion, prescription draft and private family playback", async ({
  page,
  browser,
}) => {
  test.skip(process.env.RUN_LIVE_HYBRID !== "1", "Explicit live diagnostic opt-in required");
  test.setTimeout(300_000);
  const env = { ...loadEnv("development", process.cwd(), ""), ...process.env };
  const admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const ids: string[] = [];
  const objects: { bucket: string; path: string }[] = [];
  const clients: ReturnType<typeof createClient>[] = [];
  const accounts: { email: string; password: string; id: string }[] = [];
  let familyId: string | undefined;
  const aws = new AwsClient({
    accessKeyId: env.aws_access_key_id || env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.aws_secret_access_key || env.AWS_SECRET_ACCESS_KEY!,
    region: env.aws_region || env.AWS_REGION!,
    service: "dynamodb",
  });
  const ddb = async (operation: string, body: unknown) => {
    const r = await aws.fetch("https://dynamodb.us-east-1.amazonaws.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        "X-Amz-Target": `DynamoDB_20120810.${operation}`,
      },
      body: JSON.stringify(body),
    });
    expect(r.ok, `DynamoDB ${operation}`).toBe(true);
    return r.json();
  };
  const login = async (target: Page, account: (typeof accounts)[number]) => {
    await target.addInitScript(() =>
      localStorage.setItem(
        "sn_privacy_choice_v1",
        JSON.stringify({
          preferences: false,
          statistics: false,
          marketing: false,
          savedAt: Date.now(),
        }),
      ),
    );
    await target.goto("/auth", { waitUntil: "domcontentloaded" });
    await target.getByLabel("Email", { exact: true }).fill(account.email);
    await target.getByLabel("Password", { exact: true }).fill(account.password);
    await target.getByRole("button", { name: /sign in|log in/i, exact: true }).click();
    await expect(target).toHaveURL(/\/dashboard$/, { timeout: 45_000 });
  };
  try {
    for (const name of ["Sender", "Recipient", "Outsider"]) {
      const email = `hybrid-${name.toLowerCase()}-${randomUUID()}@someonenear.test`;
      const password = `Diag!${randomUUID()}aA1`;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `Diagnostic ${name}` },
      });
      expect(created.error?.message).toBeUndefined();
      const id = created.data.user!.id;
      ids.push(id);
      accounts.push({ email, password, id });
      expect(
        (
          await admin
            .from("profiles")
            .update({
              display_name: `Diagnostic ${name}`,
              onboarding_completed: true,
              care_tier: "care_plus",
            })
            .eq("id", id)
        ).error,
      ).toBeNull();
      const client = createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false },
      });
      expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
      clients.push(client);
    }
    const family = await admin
      .from("families")
      .insert({ owner_id: ids[0], name: "Disposable diagnostic family" })
      .select("id")
      .single();
    expect(family.error).toBeNull();
    familyId = family.data!.id;
    expect(
      (
        await admin.from("family_members").upsert(
          [
            { family_id: familyId, user_id: ids[0], role: "owner" },
            { family_id: familyId, user_id: ids[1], role: "adult" },
          ],
          { onConflict: "user_id" },
        )
      ).error,
    ).toBeNull();
    await login(page, accounts[0]);
    console.log("Disposable account login passed.");
    if (process.env.ONLY_MEDIA !== "1") {
      await page.goto("/companion");
      const prompt = "I enjoyed a little gardening today.";
      await page.getByLabel("What’s on your mind?", { exact: true }).fill(prompt);
      const chatResponse = page.waitForResponse(
        (r) => r.url().endsWith("/api/chat") && r.request().method() === "POST",
        { timeout: 120_000 },
      );
      await page.getByRole("button", { name: "Send →", exact: true }).click();
      expect((await chatResponse).status()).toBe(200);
      await expect(page.getByText("Listening…", { exact: true })).toHaveCount(0, {
        timeout: 120_000,
      });
      const conversationId = new URL(page.url()).pathname.split("/").pop()!;
      const history = await clients[0]
        .from("messages")
        .select("role,content")
        .eq("conversation_id", conversationId);
      expect(history.data?.map((m) => m.role)).toEqual(
        expect.arrayContaining(["user", "assistant"]),
      );
      const summary = await ddb("GetItem", {
        TableName: env.dynamodb_summary_table || env.DYNAMODB_SUMMARY_TABLE,
        Key: { subjectId: { S: ids[0] } },
        ConsistentRead: true,
      });
      expect(summary.Item?.summary?.S?.length).toBeGreaterThan(0);
      console.log("Live Companion and summary passed.");
      const token = (await clients[2].auth.getSession()).data.session!.access_token;
      const denied = await page.request.post("/api/chat", {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          conversationId,
          messages: [
            {
              id: randomUUID(),
              role: "user",
              parts: [{ type: "text", text: "Synthetic unauthorized check" }],
            },
          ],
        },
      });
      expect(denied.status()).toBe(404);
      await page.getByRole("tab", { name: /Memory.*Privacy/ }).click();
      await expect(page.getByRole("button", { name: /Clear.*summary/ })).toBeEnabled();
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: /Clear.*summary/ }).click();
      await expect(page.getByText("No continuity summary yet.", { exact: true })).toBeVisible();

      console.log("Summary clear and conversation isolation passed.");
    }
    const fixture = await browser.newPage();
    await fixture.setViewportSize({ width: 800, height: 450 });
    await fixture.setContent(
      '<main style="padding:40px;font:28px sans-serif;background:white;color:black"><h2>SYNTHETIC TEST — NOT FOR MEDICAL USE</h2><p>Medicine: SampleMed</p><p>Dosage: 5 mg tablet</p><p>Instructions: One tablet in the morning</p></main>',
    );
    const image = await fixture.screenshot({ timeout: 15000 });
    console.log("Synthetic photo created.");
    await fixture.close();
    console.log("Opening PhotoMed.");
    await page.goto("/reminders", { waitUntil: "domcontentloaded" });
    console.log("PhotoMed loaded.");
    await page.getByRole("button", { name: /Add Pill-Strip Photo Med/i }).click();
    await page
      .locator('input[type="file"][accept="image/jpeg,image/png,image/webp,image/heic,image/heif"]')
      .setInputFiles({ name: "synthetic-prescription.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "Read this photo" }).click();
    console.log("PhotoMed extraction requested.");
    await expect(page.getByRole("button", { name: "Reading the photo…" })).toHaveCount(0, {
      timeout: 60000,
    });
    console.log(
      "PhotoMed finished; review field count:",
      await page.getByRole("textbox", { name: /Medicine name/ }).count(),
    );
    await expect(page.getByRole("textbox", { name: /Medicine name/ })).toHaveValue(/SampleMed/i, {
      timeout: 90_000,
    });
    console.log("PhotoMed draft extracted.");
    const uploaded = await admin.storage.from("prescriptions").list(ids[0]);
    for (const file of uploaded.data ?? [])
      objects.push({ bucket: "prescriptions", path: `${ids[0]}/${file.name}` });
    const medications = await clients[0].from("medications").select("id").eq("added_by", ids[0]);
    expect(medications.data).toHaveLength(0);

    // A small valid WAV; upload and schedule through the real UI.
    const wav = Buffer.alloc(44 + 1600);
    wav.write("RIFF");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(1600, 40);
    await page.goto("/send-later?section=studio");
    console.log("Voice studio loaded.");
    await page
      .locator("select")
      .filter({ has: page.locator(`option[value="${ids[1]}"]`) })
      .selectOption(ids[1]);
    console.log("Family recipient selected.");
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "diagnostic.wav", mimeType: "audio/wav", buffer: wav });
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    await page.getByLabel(/Date & time/).fill(future);
    const scheduling = page.waitForResponse(
      (r) => r.url().includes("_serverFn") && r.request().method() === "POST",
      { timeout: 20000 },
    );
    await page.getByRole("button", { name: "Schedule message", exact: true }).click();
    const scheduledResponse = await scheduling;
    expect(scheduledResponse.status()).toBe(200);
    expect(await scheduledResponse.text()).not.toContain('"c":"$TSR/Error"');
    await expect
      .poll(
        async () =>
          (await clients[0].from("scheduled_messages").select("id").eq("user_id", ids[0])).data
            ?.length ?? 0,
        { timeout: 30000 },
      )
      .toBe(1);
    console.log("Voice message persisted.");
    const scheduled = await clients[0]
      .from("scheduled_messages")
      .select("id,s3_key")
      .eq("user_id", ids[0])
      .single();
    expect(scheduled.error).toBeNull();
    const objectPath = scheduled.data!.s3_key.replace(/^send-later\//, "");
    objects.push({ bucket: "send-later", path: objectPath });
    expect((await clients[1].storage.from("send-later").download(objectPath)).error).not.toBeNull();
    expect((await clients[2].storage.from("send-later").download(objectPath)).error).not.toBeNull();
    const senderSection = page
      .getByRole("heading", { name: "Your scheduled messages", exact: true })
      .locator("..");
    await senderSection.getByRole("button", { name: "Play recording" }).click();
    await expect(page.getByRole("region", { name: "Message playback" })).toBeVisible();
    const senderUrl = await page.locator("audio[src^='https:']").getAttribute("src");
    expect((await page.request.get(senderUrl!)).status()).toBe(200);
    expect(
      (
        await admin
          .from("scheduled_messages")
          .update({
            status: "delivered",
            scheduled_at: new Date(Date.now() - 60000).toISOString(),
            delivered_at: new Date().toISOString(),
          })
          .eq("id", scheduled.data!.id)
      ).error,
    ).toBeNull();
    const recipientContext = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8082",
    });
    const recipient = await recipientContext.newPage();
    await login(recipient, accounts[1]);
    await recipient.goto("/send-later");
    const inbox = recipient.getByRole("heading", { name: "For you", exact: true }).locator("..");
    await inbox.getByRole("button", { name: "Play recording" }).click();
    await expect(recipient.getByRole("region", { name: "Message playback" })).toBeVisible();
    const recipientUrl = await recipient.locator("audio").getAttribute("src");
    expect((await recipient.request.get(recipientUrl!)).status()).toBe(200);
    await recipientContext.close();
    console.log(
      "Authenticated chat, owner isolation, summary clear, Gemini image draft and delivered family playback passed.",
    );
  } catch (error) {
    console.log("Visible media error:", await page.getByRole("alert").allTextContents());
    throw error;
  } finally {
    for (const obj of objects)
      expect((await admin.storage.from(obj.bucket).remove([obj.path])).error).toBeNull();
    // Clean up any upload left by a failed UI step, scoped to these disposable UUIDs only.
    for (const id of ids)
      for (const bucket of ["prescriptions", "send-later"]) {
        const files = await admin.storage.from(bucket).list(id);
        if (files.data?.length)
          await admin.storage.from(bucket).remove(files.data.map((f) => `${id}/${f.name}`));
      }
    for (const id of ids) {
      const table = env.dynamodb_safety_table || env.DYNAMODB_SAFETY_TABLE;
      const audits = await ddb("Query", {
        TableName: table,
        KeyConditionExpression: "subjectId = :s",
        ExpressionAttributeValues: { ":s": { S: id } },
      });
      for (const item of audits.Items ?? [])
        await ddb("DeleteItem", {
          TableName: table,
          Key: { subjectId: { S: id }, eventId: item.eventId },
        });
      await ddb("DeleteItem", {
        TableName: env.dynamodb_summary_table || env.DYNAMODB_SUMMARY_TABLE,
        Key: { subjectId: { S: id } },
      });
    }
    if (familyId) await admin.from("families").delete().eq("id", familyId);
    for (const id of ids) expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
