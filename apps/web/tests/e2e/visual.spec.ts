import { expect, test } from "@playwright/test";

const sharedFixtureFrames = [
  ["resolved", 0],
  ["resolved", 1],
  ["resolved", 2],
  ["resolved", 3],
  ["resolved", 4],
  ["cameraDenied", 0],
  ["cameraDenied", 1],
  ["reconnecting", 0],
  ["reconnecting", 1],
  ["failed", 0],
] as const;

test.describe("visual state records", () => {
  test("records every frozen Guest fixture frame at 320px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-320", "mobile snapshot suite");
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const [fixture, frame] of sharedFixtureFrames) {
      await page.goto(`/guest?access=valid&fixture=${fixture}&frame=${frame}`);
      await expect(page).toHaveScreenshot(`guest-${fixture}-${frame}-mobile.png`, {
        animations: "disabled",
        fullPage: true,
      });
    }

    await page.goto("/guest?access=expired&fixture=expiredLink");
    await expect(page).toHaveScreenshot("guest-expiredLink-0-mobile.png", {
      animations: "disabled",
      fullPage: true,
    });
  });

  test("records stable desktop landing and Guest camera states", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop snapshot suite");
    await page.emulateMedia({ reducedMotion: "reduce" });
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

    await page.goto("/");
    await expect(page).toHaveScreenshot("landing-static-desktop.png", {
      animations: "disabled",
      fullPage: true,
    });

    await page.goto("/guest?access=valid&fixture=cameraRequested");
    await expect(page).toHaveScreenshot("guest-camera-request-desktop.png", {
      animations: "disabled",
      fullPage: true,
    });
  });
});
