import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __cameraRequests: number;
  }
}

test.describe("explicit camera permission", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__cameraRequests = 0;
    });
  });

  test("never requests permission before explicit Guest acceptance", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => {
            window.__cameraRequests += 1;
            return Promise.reject(new DOMException("Blocked for test", "NotAllowedError"));
          },
        },
      });
    });
    await page.goto("/guest?access=valid&fixture=cameraRequested");

    expect(await page.evaluate(() => window.__cameraRequests)).toBe(0);
    await page.getByRole("button", { name: "Accept camera" }).click();
    await expect(page.getByRole("heading", { name: "Camera permission denied" })).toBeVisible();
    expect(await page.evaluate(() => window.__cameraRequests)).toBe(1);
  });

  test("declining keeps voice available and never requests browser permission", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => {
            window.__cameraRequests += 1;
            return Promise.resolve(new MediaStream());
          },
        },
      });
    });
    await page.goto("/guest?access=valid&fixture=cameraRequested");
    await page.getByRole("button", { name: "Continue by voice" }).click();

    await expect(page.getByRole("heading", { name: "Camera declined" })).toBeVisible();
    await expect(page.getByText("Voice troubleshooting is still available.")).toBeVisible();
    expect(await page.evaluate(() => window.__cameraRequests)).toBe(0);
  });

  test("reports an unavailable camera and keeps the incident safe", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    });
    await page.goto("/guest?access=valid&fixture=cameraRequested");
    await page.getByRole("button", { name: "Accept camera" }).click();

    await expect(page.getByRole("heading", { name: "Camera unavailable" })).toBeVisible();
    await expect(page.getByText("Your incident remains open", { exact: false })).toBeVisible();
  });

  test("shows a preview after acceptance and can return to voice-only", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => {
            window.__cameraRequests += 1;
            return Promise.resolve(new MediaStream());
          },
        },
      });
    });
    await page.goto("/guest?access=valid&fixture=cameraRequested");
    await page.getByRole("button", { name: "Accept camera" }).click();

    await expect(page.getByLabel("Live camera preview")).toBeVisible();
    await page.getByRole("button", { name: "Stop camera and return to voice" }).click();
    await expect(page.getByRole("heading", { name: "Camera disconnected" })).toBeVisible();
  });
});
