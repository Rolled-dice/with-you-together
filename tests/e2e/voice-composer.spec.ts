import { expect, test, type Page } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

async function openComposer(page: Page, recording = false) {
  await page.addInitScript(
    ({ recording }) => {
      class Recognition {
        lang = "";
        continuous = false;
        interimResults = false;
        maxAlternatives = 1;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((event: { error: string }) => void) | null = null;
        onresult:
          | ((event: {
              resultIndex: number;
              results: { isFinal: boolean; 0: { transcript: string } }[];
            }) => void)
          | null = null;
        static current: Recognition;
        constructor() {
          Recognition.current = this;
        }
        start() {
          this.onstart?.();
        }
        stop() {
          this.onend?.();
        }
        abort() {}
      }
      Object.defineProperty(window, "SpeechRecognition", {
        configurable: true,
        value: recording ? undefined : Recognition,
      });
      Object.defineProperty(window, "webkitSpeechRecognition", {
        configurable: true,
        value: undefined,
      });
      if (recording) {
        const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          const stream = await capture(constraints);
          Object.defineProperty(window, "voiceStream", { configurable: true, value: stream });
          return stream;
        };
      }
      Object.defineProperty(window, "voiceTest", {
        value: {
          say(text: string, final = true) {
            Recognition.current.onresult?.({
              resultIndex: 0,
              results: [{ isFinal: final, 0: { transcript: text } }],
            });
          },
          deny() {
            Recognition.current.onerror?.({ error: "not-allowed" });
          },
        },
      });
    },
    { recording },
  );
  await page.route("**/__voice_test__*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Companion voice test</title></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/tests/e2e/fixtures/companion-composer.tsx');
    </script></body></html>`,
    }),
  );
  await page.goto(recording ? "/__voice_test__?recording=1" : "/__voice_test__");
  await expect(page.getByRole("textbox", { name: "Message to Companion" })).toBeVisible();
}

test.describe("Voice composer", () => {
  test.skip(
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080").hostname,
    ),
    "The composer fixture requires a local Vite development server.",
  );
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    test(`voice draft, editing and manual send at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await openComposer(page);
      await expect(page.getByRole("combobox", { name: "Voice language" })).toHaveCount(0);
      const input = page.getByRole("textbox", { name: "Message to Companion" });
      await input.fill("Today");
      await page.getByRole("button", { name: "Start voice input" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("button", { name: "Stop listening" })).toBeVisible();
      await page.evaluate(() => {
        const api = Reflect.get(window, "voiceTest");
        api.say("I feel", false);
      });
      await expect(page.getByLabel("Speech being recognized")).toHaveText("I feel");
      await page.evaluate(() => {
        Reflect.get(window, "voiceTest").say("I feel happy");
      });
      await expect(input).toHaveValue("Today I feel happy");
      await input.press("Enter");
      await expect(page.getByTestId("sent-message")).toBeEmpty();
      await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
      const buttons = page.locator("form button[aria-label]");
      for (const button of await buttons.all()) {
        const box = await button.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: testInfo.outputPath("listening.png"), fullPage: true });
      await page.getByRole("button", { name: "Stop listening" }).click();
      await input.fill("Today I feel better");
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByTestId("sent-message")).toHaveText("Today I feel better");
      await expect(input).toBeEmpty();
    });
  }

  test("denied microphone access preserves typed text", async ({ page }) => {
    await openComposer(page);
    const input = page.getByRole("textbox", { name: "Message to Companion" });
    await input.fill("My original words");
    await page.getByRole("button", { name: "Start voice input" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.evaluate(() => {
      Reflect.get(window, "voiceTest").deny();
    });
    await expect(page.getByRole("alert")).toContainText("denied");
    await expect(input).toHaveValue("My original words");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByTestId("sent-message")).toHaveText("My original words");
  });
});

test.describe("Recording fallback", () => {
  test.skip(
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080").hostname,
    ),
    "The composer fixture requires a local Vite development server.",
  );

  test("records with the real browser API, releases the microphone and appends the returned text", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["microphone"]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/companion-transcription?*", async (route) => {
      expect(route.request().headers()["authorization"]).toBe("Bearer fixture-token");
      expect(route.request().headers()["content-type"]).toContain("audio/");
      expect(route.request().postDataBuffer()?.length).toBeGreaterThan(0);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ text: "I miss my family" }),
      });
    });
    await openComposer(page, true);
    const input = page.getByRole("textbox", { name: "Message to Companion" });
    await input.fill("Today");
    await page.getByRole("button", { name: "Start voice input" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Stop listening" })).toBeVisible();
    await expect(page.getByText("0:01", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Stop listening" }).click();
    await expect(input).toHaveValue("Today I miss my family");
    expect(
      await page.evaluate(() => {
        const stream: unknown = Reflect.get(window, "voiceStream");
        return (
          stream instanceof MediaStream &&
          stream.getTracks().every((track) => track.readyState === "ended")
        );
      }),
    ).toBe(true);
    await expect(page.getByTestId("sent-message")).toBeEmpty();
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByTestId("sent-message")).toHaveText("Today I miss my family");
  });
});
