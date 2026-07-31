import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axeRoutes = [
  "/",
  "/guest?access=verify-email",
  "/guest?access=revoked",
  "/guest?access=valid&fixture=connected",
  "/guest?access=valid&fixture=cameraRequested",
  "/guest?access=valid&fixture=resolved&frame=4",
  "/guest?access=valid&fixture=failed",
  "/guest?access=valid&fixture=escalated",
];

test.describe("inclusive interaction", () => {
  test("passes axe on landing, access, camera, success, failure, and incomplete states", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of axeRoutes) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations, `${route}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
    }
  });

  test("uses logical headings and landmarks", async ({ page }) => {
    await page.goto("/guest?access=valid&fixture=cameraRequested");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Guest navigation" })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  });

  test("keyboard focus is visible and reaches the primary Guest actions", async ({ page }) => {
    await page.goto("/guest?access=valid&fixture=cameraRequested");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Steward home" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Accept camera" })).toBeFocused();

    const focusStyle = await page.getByRole("button", { name: "Accept camera" }).evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).not.toBe("0px");
  });

  test("status remains understandable without color", async ({ page }) => {
    await page.goto("/guest?access=valid&fixture=reconnecting&frame=0");
    await expect(page.getByLabel("Current call and connection state")).toContainText("Reconnecting");
    await expect(page.getByLabel("Current call and connection state")).toContainText(
      "Your request stays open",
    );
  });
});
