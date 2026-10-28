import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".sn-preview")).toBeVisible({ timeout: 90000 });
});

for (const width of [1440, 390, 320]) {
  test(`preview globe and themes at ${width}px`, async ({ page }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 960 });
    const stage = page.locator("[data-stage]").first();
    await stage.scrollIntoViewIfNeeded();
    await expect.poll(() => stage.locator("[data-pin]").count()).toBeGreaterThan(0);
    const pixels = () =>
      stage.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext("2d");
        if (!context) return "";
        const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 0,
          visible = 0;
        for (let index = 0; index < bytes.length; index += 16) {
          hash = (Math.imul(hash, 31) + bytes[index]) | 0;
          if (bytes[index + 3]) visible++;
        }
        return visible > 100 ? String(hash) : "";
      });
    await expect.poll(pixels).not.toBe("");
    const first = await pixels();
    await expect.poll(pixels).not.toBe(first);
    await page.getByTitle("Toggle Auto-Rotation").click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const stopped = await pixels();
    await page.waitForTimeout(200);
    expect(await pixels()).toBe(stopped);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`globe-${width}-light.png`) });
    await page.getByTitle("Switch Warm Cream / Deep Navy Theme").click();
    await expect(page.locator(".sn-preview")).toHaveAttribute("data-theme", "dark");
    await stage.scrollIntoViewIfNeeded();
    await expect.poll(pixels).not.toBe("");
    await page.screenshot({ path: info.outputPath(`globe-${width}-dark.png`) });
  });
}

test("globe rotation, appearance and all-member access", async ({ page }) => {
  const stage = page.locator("[data-stage]").first();
  const canvas = stage.locator("canvas");
  await stage.scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-radius", /\d/);
  const radius = await canvas.getAttribute("data-radius");
  const yaw = await canvas.getAttribute("data-yaw");
  await expect.poll(() => canvas.getAttribute("data-yaw")).not.toBe(yaw);
  await expect(canvas).toHaveAttribute("data-radius", radius!);
  await page.getByTitle("Zoom In", { exact: true }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-radius"))).toBeGreaterThan(Number(radius));
  await page.getByText("Globe appearance", { exact: true }).click();
  await page.getByLabel("Colour palette").selectOption("emerald");
  await expect(page.getByLabel("Colour palette")).toHaveValue("emerald");
  await page.getByLabel("Pulse rings", { exact: true }).uncheck();
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTitle("Toggle Auto-Rotation")).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "View all (6)", exact: true }).click();
  const list = page.getByLabel("All family members");
  await expect(list.getByRole("button")).toHaveCount(6);
  await list.getByRole("button", { name: "Priya", exact: true }).click();
  await expect(stage.getByRole("button", { name: "View Priya's update", exact: true })).toHaveAttribute("aria-expanded", "true");
  await stage.scrollIntoViewIfNeeded();
  await page.getByTitle("Toggle Auto-Rotation").click();
  const selectedYaw = await canvas.getAttribute("data-yaw");
  await page.waitForTimeout(200);
  await expect(canvas).toHaveAttribute("data-yaw", selectedYaw!);
  await page.getByRole("button", { name: "Close member update" }).click();
  await expect.poll(() => canvas.getAttribute("data-yaw")).not.toBe(selectedYaw);
});

test("family tasks, sharing and bookings stay in the frontend", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      /supabase|\/api\/|\/_server\//.test(request.url())
    )
      writes.push(request.url());
  });
  await page.getByRole("button", { name: "Our family", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  const workspace = page.locator("[data-workspace-view]");
  await expect(workspace.getByRole("heading", { name: "Today with Dad" })).toBeVisible();
  await workspace.getByRole("button", { name: "Done", exact: true }).click();
  await expect(workspace.getByText("Completed", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "My sharing", exact: true }).click();
  await expect(workspace.getByRole("checkbox")).toHaveCount(3);
  for (const box of await workspace.getByRole("checkbox").all())
    await expect(box).not.toBeChecked();
  await workspace.getByLabel("Receive family-created reminders").check();
  await expect(workspace.getByLabel("Share completion updates")).not.toBeChecked();
  await workspace.getByLabel("Title", { exact: true }).fill("A lovely afternoon");
  await workspace.getByLabel("Your update", { exact: true }).fill("Tea together in the garden.");
  await workspace
    .locator("input[type=file]")
    .setInputFiles({
      name: "family.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTWQAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await workspace.getByRole("button", { name: "Add to preview feed" }).click();
  await expect(workspace.getByRole("img", { name: "A lovely afternoon" })).toBeVisible();
  await expect(workspace.getByRole("link", { name: "Download file" })).toHaveAttribute(
    "href",
    /^blob:/,
  );
  await page.getByRole("button", { name: "Calls", exact: true }).click();
  await workspace.getByLabel("Date and time", { exact: true }).fill("2026-11-01T10:30");
  await workspace.getByRole("button", { name: "Add preview booking" }).click();
  await expect(workspace.getByText("2026-11-01 10:30", { exact: true })).toBeVisible();
  await expect(workspace.getByText("28 / 30")).toBeVisible();
  await workspace.getByRole("button", { name: "Cancel", exact: true }).last().click();
  await expect(workspace.getByText("29 / 30")).toBeVisible();
  await page.getByRole("button", { name: "Health", exact: true }).click();
  await expect(workspace.getByRole("heading", { name: "Health & medication" })).toBeVisible();
  await page.getByRole("button", { name: "Companion", exact: true }).click();
  await expect(workspace.getByRole("heading", { name: "A little company" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("keyboard controls, invitations and arcade", async ({ page }) => {
  await page.getByRole("button", { name: "Avatars", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Motif: waves" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Start a Care Plan" }).click();
  await dialog.getByPlaceholder("e.g., Nani Ji, Papa, Chacha Ji...").fill("Uncle");
  await dialog.getByRole("button", { name: "Add preview invitation" }).click();
  await expect(
    page.getByText("Invitation added to the preview queue.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chatak-Patak", exact: true }).click();
  const bubble = page.getByRole("button", { name: "Pop bubble 1", exact: true });
  await bubble.focus();
  await page.keyboard.press("Enter");
  await expect(bubble).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Open care actions" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Open care actions" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});
