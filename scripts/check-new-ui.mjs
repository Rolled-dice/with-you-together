import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.CHECK_BASE_URL || "http://127.0.0.1:8082";
if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD)
  throw new Error("Provide test credentials through the environment.");
await mkdir("artifacts/new-ui", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  const failures = [];
  page.on("response", (response) => {
    if (response.status() >= 500 && new URL(response.url()).origin === new URL(base).origin)
      failures.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  await page.goto(`${base}/auth`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("#signin-email").fill(process.env.TEST_EMAIL);
  await page.locator("#signin-password").fill(process.env.TEST_PASSWORD);
  await page.locator("#signin-password").press("Enter");
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  await page.getByRole("button", { name: "Open care actions" }).waitFor();
  console.log("PASS real sign-in and dashboard");
  await page.getByRole("button", { name: "Open care actions" }).click();
  const prescription = page.getByRole("link", { name: "Add or review a prescription" });
  if (!(await prescription.getAttribute("href")).includes("view=medication"))
    throw new Error("Wrong prescription destination");
  await prescription.click();
  await page.waitForURL("**/reminders?view=medication");
  console.log("PASS care actions open the real prescription screen");
  await page.goto(`${base}/family`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Family", exact: true }).waitFor({ timeout: 60000 });
  await page
    .locator('[data-testid="family-globe"][data-globe-ready="true"]')
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: "artifacts/new-ui/connected-family-desktop.png", fullPage: true });
  for (const name of ["Today", "My sharing", "Health", "Calls"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await page.waitForTimeout(1500);
    const text = await page.locator('[role="tabpanel"][data-state="active"]').innerText();
    if (
      /family service is unavailable|reminders are unavailable|could not be loaded|could not load|failed to load/i.test(
        text,
      )
    )
      throw new Error(`${name} failed: ${text.slice(0, 250)}`);
    console.log(`PASS real family ${name} screen`);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Family", exact: true }).waitFor({ timeout: 30000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/new-ui/connected-family-mobile.png", fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error("Mobile family overflow");
  console.log("PASS session refresh and mobile family layout");
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByTestId("care-world").waitFor();
  await page
    .locator('[data-testid="care-world"][data-globe-ready="true"]')
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: "artifacts/new-ui/home-mobile.png", fullPage: false });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: "artifacts/new-ui/home-desktop.png", fullPage: false });
  if (failures.length) throw new Error(`Server failures: ${JSON.stringify(failures)}`);
  console.log("PASS globe homepage and no same-origin server failures");
} finally {
  await browser.close();
}
