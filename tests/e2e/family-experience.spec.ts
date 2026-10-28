import { expect, test, type Page } from "@playwright/test";
async function openFixture(page: Page, mode: string) {
  await page.routeWebSocket("**/realtime/**", (socket) => socket.close());
  await page.route("**/__family_test__*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap" /></head><body><div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;
    await import('/tests/e2e/fixtures/family-experience.tsx');
  </script></body></html>`,
    }),
  );
  await page.goto(`/__family_test__?mode=${mode}`);
  await expect(page.getByRole("heading", { name: "Our family", exact: true })).toBeVisible();
}
for (const width of [1280, 390, 320]) {
  for (const theme of ["light", "dark"]) {
    test(`owner invitation and layouts ${width}px ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme as "light" | "dark" });
      await openFixture(page, "owner");
      if (theme === "dark")
        await page.evaluate(() => document.documentElement.classList.add("dark"));
      const themeColors = await page.evaluate(() => ({
        site: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
        family: getComputedStyle(document.querySelector(".family-experience")!)
          .getPropertyValue("--primary")
          .trim(),
      }));
      expect(themeColors.family).toBe(themeColors.site);
      await expect(page.getByText("3 of 5 places occupied or reserved")).toBeVisible();
      await expect(page.getByTestId("family-globe")).toHaveAttribute("data-globe-ready", "true");
      await expect(page.getByTestId("family-globe")).toHaveAttribute("data-globe-texture", "ready");
      await page.screenshot({ path: info.outputPath("family-members.png"), fullPage: true });
      await page.getByRole("button", { name: "Invite adult relative" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: info.outputPath("family-invitation.png"), fullPage: true });
      await page.getByLabel("Their name").fill("Mother");
      await page.getByLabel("Email address").fill("mother@example.test");
      await expect(page.getByRole("radio", { name: "SMS" })).toBeDisabled();
      await page.getByRole("button", { name: "Send invitation", exact: true }).click();
      await expect(dialog).toBeHidden();
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Visit Dr. Mehta" })).toBeVisible();
      await expect(page.getByRole("button", { name: "I attended" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath("family.png"), fullPage: true });
    });
  }
}
test("parent can confirm attendance and review an update before sending", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, "parent");
  await page.getByRole("button", { name: "I attended" }).click();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add an update" }).click();
  const text = page.getByRole("textbox", { name: "Your update" });
  await text.fill("I visited the doctor. I feel better.");
  await expect(text).toHaveValue("I visited the doctor. I feel better.");
  await page.getByRole("button", { name: "Share update" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

for (const width of [1280, 390, 320]) {
  test(`globe shows five people and opens member details at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFixture(page, "globe");
    const globe = page.getByTestId("family-globe");
    await expect(globe).toHaveAttribute("data-globe-texture", "ready");
    await expect(page.locator("[data-globe-member]")).toHaveCount(5);
    await expect(page.locator(".family-update-cloud")).toHaveCount(1);
    await expect(page.locator(".family-update-cloud")).toHaveText("1");
    await expect(page.locator(".family-update-cloud")).toHaveAttribute(
      "aria-label",
      "1 recent shared updates",
    );
    const pixels = await globe.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext("webgl2");
      if (!gl) throw new Error("Globe renderer is unavailable");
      const values = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, values);
      let drawn = 0;
      for (let i = 3; i < values.length; i += 4) if (values[i] > 0) drawn++;
      return drawn / (canvas.width * canvas.height);
    });
    expect(pixels).toBeGreaterThan(0.1);
    const fitting = await page.locator("[data-globe-member]").evaluateAll((elements) => {
      const boxes = elements.map((element) => element.getBoundingClientRect());
      return boxes.every(
        (box, index) =>
          box.left >= 0 &&
          box.right <= innerWidth &&
          boxes
            .slice(index + 1)
            .every(
              (other) =>
                box.right <= other.left ||
                box.left >= other.right ||
                box.bottom <= other.top ||
                box.top >= other.bottom,
            ),
      );
    });
    expect(fitting).toBe(true);
    await page.screenshot({ path: info.outputPath("globe.png"), fullPage: true });
    await page.getByRole("button", { name: "Open Dad's member details", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Dad", exact: true })).toBeVisible();
    await expect(
      dialog.getByText("I visited the doctor. Feeling better.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Edit my sharing" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "View health" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "View reminders" }).click();
    await expect(page.getByLabel("Show reminders for")).toHaveValue(
      "10000000-0000-4000-8000-000000000002",
    );
    await expect(page.getByRole("heading", { name: "Visit Dr. Mehta" })).toBeVisible();
  });
}

test("globe moves, pauses, and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openFixture(page, "owner");
  await expect(page.getByTestId("family-globe")).toHaveAttribute("data-globe-texture", "ready");
  const pin = page.getByRole("button", { name: "Open Dad's member details", exact: true });
  const start = await pin.getAttribute("style");
  await expect.poll(() => pin.getAttribute("style")).not.toBe(start);
  await page.getByRole("button", { name: "Pause globe animation" }).click();
  await page.waitForTimeout(100);
  const stopped = await pin.getAttribute("style");
  await page.waitForTimeout(250);
  expect(await pin.getAttribute("style")).toBe(stopped);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Play globe animation" })).toHaveCount(0);
});

test("avatars are selectable only by the member and globe controls change the view", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await openFixture(page, "globe");
  const globe = page.getByTestId("family-globe");
  await expect(globe).toHaveAttribute("data-globe-texture", "ready");
  const pin = page.getByRole("button", { name: "Open Aarav's member details", exact: true });
  const beforeZoom = await pin.getAttribute("style");
  await page.getByRole("button", { name: "Zoom in globe" }).click();
  await expect.poll(() => pin.getAttribute("style")).not.toBe(beforeZoom);
  await page.getByRole("button", { name: "Reset globe view" }).click();
  await expect.poll(() => pin.getAttribute("style")).toBe(beforeZoom);
  const box = (await globe.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => pin.getAttribute("style")).not.toBe(beforeZoom);
  const beforeAvatar = await pin.locator(".family-avatar").screenshot();
  await pin.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio")).toHaveCount(12);
  await dialog.getByRole("radio", { name: "Avatar 8", exact: true }).check();
  await dialog.getByRole("button", { name: "Save avatar", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "familyLastCall")?.name))
    .toBe("updateMyProfile");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect
    .poll(async () => (await pin.locator(".family-avatar").screenshot()).equals(beforeAvatar))
    .toBe(false);
  await page.getByRole("button", { name: "Open Dad's member details", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("radio")).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({ path: info.outputPath("family-globe-dark.png"), fullPage: true });
});

test("large text keeps member targets usable and keyboard opens sharing settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page, "globe");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "24px";
  });
  await expect(page.getByTestId("family-globe")).toHaveAttribute("data-globe-texture", "ready");
  const boxesFit = await page.locator("[data-globe-member]").evaluateAll((elements) => {
    const boxes = elements.map((element) => element.getBoundingClientRect());
    return boxes.every(
      (box, index) =>
        box.left >= 0 &&
        box.right <= innerWidth &&
        boxes
          .slice(index + 1)
          .every(
            (other) =>
              box.right <= other.left ||
              box.left >= other.right ||
              box.bottom <= other.top ||
              box.top >= other.bottom,
          ),
    );
  });
  expect(boxesFit).toBe(true);
  const member = page.getByRole("button", { name: "Open Aarav's member details", exact: true });
  await member.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Aarav", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit my sharing" }).click();
  await expect(page.getByRole("tab", { name: "My sharing" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("theme preferences persist across family navigation and reload", async ({ page }) => {
  await openFixture(page, "theme");
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await openFixture(page, "owner");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await openFixture(page, "theme");
  await expect(page.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Device", exact: true }).check();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
});
test("invitation sharing starts off and staff must confirm consent", async ({ page }) => {
  await openFixture(page, "invite");
  for (const control of await page.getByRole("switch").all())
    await expect(control).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Accept and request call" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Accept and request call" })).toBeEnabled();
  await openFixture(page, "staff");
  await expect(page.getByText("Father · 2 of 3 contact attempts")).toBeVisible();
  await page.getByLabel("Call outcome").selectOption("verified");
  await expect(page.getByRole("button", { name: "Save call outcome" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Save call outcome" })).toBeEnabled();
});
test("large text and keyboard focus fit the invitation form", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openFixture(page, "invite");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "24px";
  });
  await page.getByLabel("Your name").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Number for your welcome call")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
