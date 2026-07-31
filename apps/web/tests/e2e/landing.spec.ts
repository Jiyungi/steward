import { expect, test } from "@playwright/test";

async function disableWebGl(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test.describe("landing foundation", () => {
  test("navigation, copy, and CTA work before the 3D bundle activates", async ({ page }) => {
    await page.addInitScript(() => {
      window.requestIdleCallback = () => 42;
      window.cancelIdleCallback = () => undefined;
    });
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Every signal, carried through." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open guest demo" })).toBeVisible();
    await expect(page.getByTestId("scene-fallback")).toBeAttached();
    await expect(page.getByTestId("three-scene")).toHaveCount(0);
  });

  test("static fallback remains deliberate when WebGL is disabled", async ({ page }) => {
    await disableWebGl(page);
    await page.goto("/");

    await expect(page.locator("[data-scene-state='unsupported']")).toBeVisible();
    await expect(page.getByTestId("scene-fallback")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("complete static scene");
    await expect(page.getByRole("link", { name: "Open guest demo" })).toBeEnabled();
  });

  test("reduced motion preserves a stable composition and all content", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    await expect(page.getByTestId("scene-fallback")).toBeAttached();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open guest demo" })).toBeVisible();

    const canvas = page.getByTestId("three-scene");
    if ((await canvas.count()) > 0) {
      await expect(canvas).toHaveCSS("animation-name", "none");
    } else {
      await expect(page.getByTestId("scene-fallback")).toBeVisible();
    }
  });

  test("enhanced scene loads without browser errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");

    await expect
      .poll(() => page.locator("[data-scene-state]").getAttribute("data-scene-state"))
      .toMatch(/enhanced|unsupported/);
    expect(errors).toEqual([]);
  });

  test("landing is usable without JavaScript", async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL as string,
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open guest demo" })).toBeVisible();
    await expect(page.getByTestId("scene-fallback")).toBeVisible();
    await context.close();
  });
});
