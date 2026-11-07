import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
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
});

for (const width of [320, 1440]) {
  test(`sample globe customization at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const globe = page.getByRole("region", { name: "Interactive sample family globe" });
    const edit = page.getByRole("button", { name: "Customize globe", exact: true });
    await expect(edit).toBeEnabled();
    await globe.scrollIntoViewIfNeeded();
    await globe.screenshot({ path: resolve("../outputs", `corrected-globe-${width}.png`) });
    await edit.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Changes last until you reload");
    await dialog.getByRole("button", { name: "Add member", exact: true }).click();
    await dialog.getByLabel("Name", { exact: true }).fill("Nana");
    await dialog.getByRole("combobox", { name: "Avatar", exact: true }).selectOption("aged-woman");
    await dialog.getByRole("combobox", { name: "Backdrop", exact: true }).selectOption("waves");
    await dialog
      .getByRole("textbox", { name: "Sample note", exact: true })
      .fill("A little hello from the garden.");
    await dialog.getByLabel("Position around globe", { exact: true }).fill("210");
    await dialog.getByLabel("Position from top", { exact: true }).fill("65");
    await dialog
      .getByRole("combobox", { name: "Globe theme", exact: true })
      .selectOption("emerald");
    await dialog.getByRole("button", { name: "Apply changes", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(globe.getByRole("button", { name: "Nana", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(globe.getByRole("button", { name: "Meet Nana", exact: true })).toBeVisible();
    await expect(globe.locator(".sn-globe-note")).toContainText("garden");
    await expect(globe.getByRole("button", { name: "Start globe rotation" })).toBeVisible();
    await globe.screenshot({ path: resolve("../outputs", `customized-globe-${width}.png`) });
    await edit.click();
    await expect(dialog.getByRole("combobox", { name: "Globe theme", exact: true })).toHaveValue(
      "emerald",
    );
    await expect(dialog.getByLabel("Position around globe", { exact: true })).toHaveValue("210");
    await dialog.screenshot({ path: resolve("../outputs", `globe-studio-${width}.png`) });
    await dialog.getByLabel("Name", { exact: true }).fill("   ");
    await dialog.getByRole("button", { name: "Apply changes" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Give each sample member a name.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(globe.getByRole("button", { name: "Nana", exact: true })).toBeVisible();
    await edit.click();
    await dialog.getByRole("button", { name: "Remove this sample member" }).click();
    await dialog.getByRole("button", { name: "Apply changes" }).click();
    await expect(globe.getByRole("button", { name: "Nana", exact: true })).toHaveCount(0);
    await edit.click();
    await dialog.getByRole("button", { name: "Reset sample", exact: true }).click();
    await expect(globe.locator(".sn-globe-people button")).toHaveCount(6);
    await globe.getByRole("button", { name: "Mum", exact: true }).click();
    await expect(globe.getByRole("button", { name: "Meet Mum", exact: true })).toBeVisible();
    const stage = globe.getByRole("group", {
      name: "Rotate globe with arrow keys or drag",
      exact: true,
    });
    await stage.focus();
    const before = await globe
      .locator(".sn-globe-node")
      .filter({ has: page.getByRole("button", { name: "Meet Mum" }) })
      .getAttribute("style");
    await stage.press("ArrowRight");
    await expect(
      globe
        .locator(".sn-globe-node")
        .filter({ has: page.getByRole("button", { name: "Meet Mum" }) }),
    ).not.toHaveAttribute("style", before!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}

test("original globe animates, pauses and opens the supplied member card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const globe = page.getByRole("region", { name: "Interactive sample family globe" });
  await expect(globe.getByRole("button", { name: "Pause globe rotation" })).toBeEnabled();
  await globe.scrollIntoViewIfNeeded();
  const canvas = globe.locator("canvas");
  const firstFrame = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await expect
    .poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL()))
    .not.toBe(firstFrame);
  await globe.getByRole("button", { name: "Pause globe rotation" }).click();
  await globe.getByRole("button", { name: "Aarav (you)", exact: true }).click();
  const card = globe.getByRole("group", { name: "Aarav (you)'s sample update", exact: true });
  await expect(card).toContainText("Sunday mango delivery");
  await card.getByRole("button", { name: "Ignore sample call opt-in" }).click();
  await expect(card.locator(".sn-globe-opt-in strong")).toHaveText("ignored");
  await card.getByRole("button", { name: "Confirm sample call opt-in" }).click();
  await expect(card.locator(".sn-globe-opt-in strong")).toHaveText("confirmed");
  await expect(card).toContainText("No calls are placed");
  await globe.screenshot({ path: resolve("../outputs", "original-source-globe.png") });
  const pausedFrame = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  // Changing another UI control gives the animation loop time to render another frame.
  await card.getByRole("button", { name: "Close sample update" }).click();
  await expect(card).not.toBeVisible();
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(
    pausedFrame,
  );
});
