import {
  createGuestFixtureAdapter,
  guestScenarioFixtureSchema,
  guestScenarioFixtures,
} from "@steward/contracts";
import { describe, expect, it } from "vitest";

import { guestPresentations } from "../../lib/guest-presentations";

describe("guest presentation fixtures", () => {
  it("uses every frozen shared scenario without redefining it", () => {
    expect(guestPresentations.resolved).toBe(guestScenarioFixtures.resolved);
    expect(guestPresentations.cameraDenied).toBe(guestScenarioFixtures.cameraDenied);
    expect(guestPresentations.reconnecting).toBe(guestScenarioFixtures.reconnecting);
    expect(guestPresentations.failed).toBe(guestScenarioFixtures.failed);
    expect(guestPresentations.expiredLink).toBe(guestScenarioFixtures.expiredLink);
  });

  it("keeps all presentation-only scenarios valid against the shared schema", () => {
    for (const fixture of Object.values(guestPresentations)) {
      expect(() => guestScenarioFixtureSchema.parse(fixture)).not.toThrow();
    }
  });

  it("advances shared fixture frames only through the frozen adapter", () => {
    const adapter = createGuestFixtureAdapter(guestScenarioFixtures.resolved);
    expect(adapter.current()).toBe(guestScenarioFixtures.resolved.frames[0]);
    expect(adapter.advance()).toBe(guestScenarioFixtures.resolved.frames[1]);
    adapter.reset();
    expect(adapter.current()).toBe(guestScenarioFixtures.resolved.frames[0]);
  });
});
