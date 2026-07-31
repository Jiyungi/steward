import type { IncidentSubscriptionHandlers, IncidentSubscriptionPort, Unsubscribe } from "./frontend.js";
import type { GuestScenarioFixture, GuestTimelineFrame } from "./fixtures.js";

export interface GuestFixtureAdapter extends IncidentSubscriptionPort {
  current(): GuestTimelineFrame;
  advance(): GuestTimelineFrame;
  reset(): GuestTimelineFrame;
}

export function createGuestFixtureAdapter(scenario: GuestScenarioFixture): GuestFixtureAdapter {
  let frameIndex = 0;
  const subscribers = new Set<IncidentSubscriptionHandlers>();

  function current(): GuestTimelineFrame {
    const frame = scenario.frames[frameIndex];
    if (frame === undefined) {
      throw new Error(`Fixture ${scenario.name} has no frame at index ${frameIndex}`);
    }
    return frame;
  }

  function publish(frame: GuestTimelineFrame): void {
    for (const handlers of subscribers) {
      handlers.onConnectionState(frame.connection);
      handlers.onSnapshot(frame.incident);
      if (frame.voice !== null) {
        handlers.onVoiceStatus(frame.voice);
      }
    }
  }

  return {
    current,
    advance() {
      frameIndex = Math.min(frameIndex + 1, scenario.frames.length - 1);
      const frame = current();
      publish(frame);
      return frame;
    },
    reset() {
      frameIndex = 0;
      const frame = current();
      publish(frame);
      return frame;
    },
    subscribe(_incidentId: string, handlers: IncidentSubscriptionHandlers): Unsubscribe {
      subscribers.add(handlers);
      publish(current());
      return () => subscribers.delete(handlers);
    },
  };
}
