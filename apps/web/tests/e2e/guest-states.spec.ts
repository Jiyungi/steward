import { expect, test } from "@playwright/test";

const accessCases = [
  ["validating", "Checking your guest link"],
  ["verify-email", "Confirm it’s you"],
  ["demo-entry", "Try Steward as a guest"],
  ["expired", "This link is expired"],
  ["revoked", "This link is no longer active"],
] as const;

const fixtureCases = [
  ["connected", 0, "Tell me what is happening"],
  ["connecting", 0, "Preparing voice help"],
  ["speaking", 0, "Steward is responding"],
  ["vendorPending", 0, "Contacting an approved property partner"],
  ["cameraRequested", 0, "Choose whether to share a live view"],
  ["disconnected", 0, "The voice connection paused"],
  ["escalated", 0, "A person needs to continue"],
  ["resolved", 0, "Tell me what is happening"],
  ["resolved", 1, "Checking the next safe step"],
  ["resolved", 2, "Calling an approved vendor"],
  ["resolved", 3, "Choose whether to share a live view"],
  ["resolved", 4, "Outcome verified"],
  ["cameraDenied", 0, "Choose whether to share a live view"],
  ["cameraDenied", 1, "Camera declined"],
  ["reconnecting", 0, "The voice connection paused"],
  ["reconnecting", 1, "Tell me what is happening"],
  ["failed", 0, "Steward could not complete this call"],
] as const;

test.describe("Guest access and fixture states", () => {
  test("shows every temporary access state without live services", async ({ page }) => {
    for (const [access, heading] of accessCases) {
      await page.goto(`/guest?access=${access}`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    await page.goto("/guest?access=demo-entry");
    await page.getByLabel("Booking email").fill("judge@example.com");
    await page.getByRole("button", { name: "Enter demo stay" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Steward is with you." })).toBeVisible();

    await page.goto("/guest?access=expired&fixture=expiredLink");
    await expect(page.getByText("Your information remains protected.")).toBeVisible();
  });

  test("renders every shared and presentation fixture frame honestly", async ({ page }) => {
    for (const [fixture, frame, expected] of fixtureCases) {
      await page.goto(`/guest?access=valid&fixture=${fixture}&frame=${frame}`);
      await expect(page.getByText(expected, { exact: true }).first()).toBeVisible();
      await expect(page.getByLabel("Current call and connection state")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("does not show development fixture controls in a production build", async ({ page }) => {
    await page.goto("/guest?access=valid&fixture=connected");
    await expect(page.getByLabel("Development fixture switcher")).toHaveCount(0);
  });

  test("reconnect control advances to the restored fixture state", async ({ page }) => {
    await page.goto("/guest?access=valid&fixture=reconnecting&frame=0");
    await page.getByRole("button", { name: "Try voice connection again" }).click();

    await expect(page.getByLabel("Current call and connection state")).toContainText("Connected");
    await expect(page.getByText("Tell me what is happening", { exact: true })).toBeVisible();
  });

  test("fixture mode makes no requests to live providers", async ({ page }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== "http://127.0.0.1:3100") externalRequests.push(request.url());
    });

    await page.goto("/guest?access=valid&fixture=resolved&frame=3");
    await page.waitForLoadState("networkidle");
    expect(externalRequests).toEqual([]);
  });

  test("preserves the Guest workflow at 320 CSS pixels", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-320", "320px project only");
    await page.goto("/guest?access=valid&fixture=cameraRequested");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Accept camera" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue by voice" })).toBeVisible();
  });

  test("preserves primary content at desktop width and a 200%-equivalent viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop project only");
    await page.setViewportSize({ width: 640, height: 800 });
    await page.goto("/guest?access=valid&fixture=failed");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { name: "Steward could not complete this call" })).toBeVisible();
  });
});
