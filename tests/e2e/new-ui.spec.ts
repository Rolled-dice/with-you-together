import { test, expect } from "@playwright/test";

for (const width of [1440, 390, 320]) {
  for (const theme of ["light", "dark"] as const) {
    test(`care homepage ${width}px ${theme}`, async ({ page }, info) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/connected-home");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("SomeoneNear");
      const globe = page.getByTestId("care-world");
      await expect(globe).toHaveAttribute("data-globe-ready", "true", { timeout: 30000 });
      await expect(globe).toHaveAttribute("data-globe-texture", "ready");
      const nonblank = await globe.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const gl = canvas.getContext("webgl2");
        if (!gl) return false;
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let count = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) count++;
        return count > canvas.width * canvas.height * 0.1;
      });
      expect(nonblank).toBe(true);
      const fits = await globe.locator("[data-globe-member]").evaluateAll((pins) => {
        const boxes = pins.map((pin) => pin.getBoundingClientRect());
        const parent = pins[0]?.parentElement?.getBoundingClientRect();
        return (
          parent &&
          boxes.every(
            (box, index) =>
              box.top >= parent.top &&
              box.bottom <= parent.bottom &&
              boxes
                .slice(index + 1)
                .every(
                  (other) =>
                    box.right <= other.left ||
                    box.left >= other.right ||
                    box.bottom <= other.top ||
                    box.top >= other.bottom,
                ),
          )
        );
      });
      expect(fits).toBe(true);
      await page.getByRole("button", { name: "Medication", exact: true }).click();
      await expect(
        page.getByText("Keep prescriptions and medication reminders together.", { exact: false }),
      ).toBeVisible();
      await expect(page.locator(".care-feature-note a")).toHaveAttribute(
        "href",
        /redirect=%2Freminders/,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`homepage-${width}-${theme}.png`),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: theme === "dark" ? "Use light theme" : "Use dark theme" })
        .click();
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /^(?!.*dark).*$/ : /dark/);
    });
  }
}

test("public pricing and care actions use existing tools", async ({ page }) => {
  await page.goto("/connected-home");
  await expect(page.getByTestId("care-world")).toHaveAttribute("data-globe-ready", "true");
  const currency = page.getByRole("combobox", { name: "Pricing currency" });
  await page.locator("#pricing").scrollIntoViewIfNeeded();
  await currency.selectOption("inr");
  await expect(page.locator("#pricing")).toContainText("3,999");
  await expect(page.locator("#pricing")).toContainText("6,499");
  await currency.selectOption("usd");
  await expect(page.locator("#pricing")).toContainText("$49");
  await expect(page.locator("#pricing")).toContainText("$79");
  await page.getByRole("button", { name: "Open care actions" }).click();
  await expect(
    page.getByRole("link", { name: "Plan a personal reminder", exact: true }),
  ).toHaveAttribute("href", "/reminders?view=everyday");
  await expect(
    page.getByRole("link", { name: "Add or review a prescription", exact: true }),
  ).toHaveAttribute("href", "/reminders?view=medication");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open care actions" })).toBeFocused();
});

test("Chatak-Patak is interactive and sound is off initially", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/calm");
  await page.getByRole("tab", { name: "Chatak-Patak" }).click();
  await expect(page.getByRole("button", { name: "Enable sounds", exact: true })).toBeVisible();
  const bubble = page.getByRole("button", { name: "Bubble 1", exact: true });
  await bubble.focus();
  await page.keyboard.press("Enter");
  await expect(bubble).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toHaveText("47 little moments left");
  await bubble.click();
  await expect(page.getByRole("status")).toHaveText("47 little moments left");
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(bubble).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(async () => (await bubble.boundingBox())?.width).toBeGreaterThanOrEqual(44);
});
