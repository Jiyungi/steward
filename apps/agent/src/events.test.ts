import { describe, expect, it } from "vitest";

import {
  ContractEventPublisher,
  INCIDENT_EVENT_TOPIC,
  MemoryEventTransport,
  VOICE_STATUS_TOPIC,
} from "./events.js";

describe("ContractEventPublisher", () => {
  it("publishes contract-valid voice and incident events", async () => {
    const transport = new MemoryEventTransport();
    const publisher = new ContractEventPublisher("incident-1", transport);

    await publisher.voice({
      version: 1,
      incidentId: "incident-1",
      state: "listening",
      occurredAt: "2026-07-31T20:00:00.000Z",
    });
    await publisher.incident({
      version: 1,
      type: "voice.turn.received",
      incidentId: "incident-1",
      eventId: "event-1",
      occurredAt: "2026-07-31T20:00:01.000Z",
      actor: { kind: "system", component: "agent" },
      payload: {
        turnId: "turn-1",
        transcript: "The water stopped running.",
        confidence: null,
      },
    });

    expect(transport.published.map((item) => item.topic)).toEqual([
      VOICE_STATUS_TOPIC,
      INCIDENT_EVENT_TOPIC,
    ]);
  });

  it("rejects invalid event versions before publication", async () => {
    const transport = new MemoryEventTransport();
    const publisher = new ContractEventPublisher("incident-1", transport);

    await expect(
      publisher.voice({
        version: 2,
        incidentId: "incident-1",
        state: "listening",
        occurredAt: "2026-07-31T20:00:00.000Z",
      } as never),
    ).rejects.toThrow();
    expect(transport.published).toHaveLength(0);
  });

  it("rejects cross-incident publication", async () => {
    const transport = new MemoryEventTransport();
    const publisher = new ContractEventPublisher("incident-1", transport);

    await expect(
      publisher.voice({
        version: 1,
        incidentId: "incident-2",
        state: "thinking",
        occurredAt: "2026-07-31T20:00:00.000Z",
      }),
    ).rejects.toThrow(/does not match/);
  });
});
