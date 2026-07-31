import { describe, expect, it, vi } from "vitest";

import { incidentEventSchema } from "./events.js";
import { createGuestFixtureAdapter } from "./fixture-adapter.js";
import { contractFixtureCases, guestScenarioFixtures } from "./fixtures.js";

describe("shared contract fixtures", () => {
  for (const fixture of contractFixtureCases) {
    it(`${fixture.name} accepts its valid and boundary fixtures`, () => {
      expect(fixture.schema.safeParse(fixture.valid).success).toBe(true);
      expect(fixture.schema.safeParse(fixture.boundary).success).toBe(true);
    });

    it(`${fixture.name} rejects its invalid fixture`, () => {
      expect(fixture.schema.safeParse(fixture.invalid).success).toBe(false);
    });
  }
});

describe("IncidentEvent", () => {
  it("supports every approved event type", () => {
    const options = incidentEventSchema.options;
    const types = options.map((option) => option.shape.type.value);

    expect(types).toEqual([
      "incident.created",
      "voice.turn.received",
      "voice.response.started",
      "voice.interrupted",
      "incident.goal.updated",
      "incident.hypothesis.updated",
      "tool.started",
      "tool.completed",
      "vision.requested",
      "vision.permission.updated",
      "evidence.recorded",
      "vendor.call.started",
      "vendor.quote.recorded",
      "vendor.selected",
      "payment.started",
      "payment.updated",
      "incident.state.changed",
      "incident.resolved",
      "incident.escalated",
    ]);
  });
});

describe("guest UI fixture adapter", () => {
  it("covers the required independent UI states", () => {
    const frames = Object.values(guestScenarioFixtures).flatMap((scenario) => scenario.frames);
    const voiceStates = new Set(frames.flatMap((frame) => (frame.voice === null ? [] : [frame.voice.state])));
    const connections = new Set(frames.map((frame) => frame.connection));

    expect(voiceStates).toEqual(
      new Set(["listening", "thinking", "tool-pending", "camera-requested", "disconnected", "ended"]),
    );
    expect(connections).toContain("reconnecting");
    expect(connections).toContain("failed");
    expect(guestScenarioFixtures.expiredLink.access).toBe("expired");
    expect(guestScenarioFixtures.resolved.frames.at(-1)?.incident.state).toBe("resolved");
  });

  it("publishes snapshots and connection state without a backend", () => {
    const adapter = createGuestFixtureAdapter(guestScenarioFixtures.resolved);
    const onSnapshot = vi.fn();
    const onConnectionState = vi.fn();
    const onVoiceStatus = vi.fn();

    const unsubscribe = adapter.subscribe("incident-1", {
      onSnapshot,
      onConnectionState,
      onVoiceStatus,
      onEvent: vi.fn(),
      onError: vi.fn(),
    });

    adapter.advance();
    unsubscribe();

    expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(onConnectionState).toHaveBeenCalledWith("connected");
    expect(onVoiceStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: "thinking" }));
  });
});
