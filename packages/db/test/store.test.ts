import { describe, expect, it } from "vitest";

import {
  incidentEventSchema,
  incidentSnapshotSchema,
  validIncidentSnapshot,
  verifiedOutcomeSchema,
  type IncidentEvent,
  type IncidentSnapshot,
} from "@steward/contracts";

import { createInMemoryIncidentStore } from "../src/testing/index.js";

function createdEvent(snapshot: IncidentSnapshot, id = "event-created"): IncidentEvent {
  return incidentEventSchema.parse({
    version: 1,
    incidentId: snapshot.id,
    eventId: id,
    occurredAt: snapshot.updatedAt,
    actor: { kind: "system", component: "agent" },
    type: "incident.created",
    payload: { snapshot },
  });
}

describe("InMemoryIncidentStore", () => {
  it("keeps an append-only, stable event order", async () => {
    const store = createInMemoryIncidentStore();
    await store.createIncident(validIncidentSnapshot, createdEvent(validIncidentSnapshot));
    await store.appendEvent(incidentEventSchema.parse({
      version: 1,
      incidentId: validIncidentSnapshot.id,
      eventId: "event-state",
      occurredAt: "2030-01-15T18:00:02.000Z",
      actor: { kind: "system", component: "agent" },
      type: "incident.state.changed",
      payload: { from: "diagnosing", to: "sourcing", reason: "Troubleshooting did not resolve the incident." },
    }));

    const events = await store.listEvents(validIncidentSnapshot.id);
    expect(events.map(({ sequence }) => sequence)).toEqual([1, 2]);
    expect(events.map(({ event }) => event.eventId)).toEqual(["event-created", "event-state"]);
  });

  it("deduplicates operations by stable idempotency key", async () => {
    const store = createInMemoryIncidentStore();
    await store.createIncident(validIncidentSnapshot, createdEvent(validIncidentSnapshot));
    const first = await store.beginOperation({
      operationId: "operation-1",
      incidentId: validIncidentSnapshot.id,
      provider: "a1mobile",
      operation: "send-sms",
      idempotencyKey: "incident-1:sms:guest",
      startedAt: "2030-01-15T18:00:02.000Z",
    });
    const second = await store.beginOperation({
      operationId: "operation-2",
      incidentId: validIncidentSnapshot.id,
      provider: "a1mobile",
      operation: "send-sms",
      idempotencyKey: "incident-1:sms:guest",
      startedAt: "2030-01-15T18:00:03.000Z",
    });
    expect(second.operationId).toBe(first.operationId);
  });

  it("refuses closure without incident evidence and closes with verified evidence", async () => {
    const store = createInMemoryIncidentStore();
    await store.createIncident(validIncidentSnapshot, createdEvent(validIncidentSnapshot));
    const outcome = verifiedOutcomeSchema.parse({
      summary: "The guest confirmed normal operation.",
      resolutionType: "troubleshot",
      evidenceRefs: ["evidence-1"],
      verifiedAt: "2030-01-15T18:10:00.000Z",
      verifiedBy: "guest",
    });
    const resolutionEvent = incidentEventSchema.parse({
      version: 1,
      incidentId: validIncidentSnapshot.id,
      eventId: "event-resolved",
      occurredAt: outcome.verifiedAt,
      actor: { kind: "system", component: "agent" },
      type: "incident.resolved",
      payload: { outcome },
    });

    await expect(store.resolveIncident(validIncidentSnapshot.id, outcome, resolutionEvent)).rejects.toThrow(
      "Missing incident evidence",
    );
    expect((await store.getIncident(validIncidentSnapshot.id))?.state).toBe("diagnosing");

    await store.addEvidence({
      id: "evidence-1",
      incidentId: validIncidentSnapshot.id,
      kind: "message",
      summary: "Guest confirmation",
      submittedBy: "guest-session-1",
      verifiedBy: "guest",
      createdAt: outcome.verifiedAt,
    });
    const resolved = await store.resolveIncident(validIncidentSnapshot.id, outcome, resolutionEvent);
    expect(resolved.state).toBe("resolved");
    expect(resolved.outcome?.evidenceRefs).toEqual(["evidence-1"]);
  });

  it("does not mutate stored snapshots returned to callers", async () => {
    const store = createInMemoryIncidentStore();
    const snapshot = incidentSnapshotSchema.parse({ ...validIncidentSnapshot, id: "incident-clone" });
    await store.createIncident(snapshot, createdEvent(snapshot, "event-clone"));
    const read = await store.getIncident(snapshot.id);
    read!.pendingOperations.push("not-persisted");
    expect((await store.getIncident(snapshot.id))?.pendingOperations).toEqual([]);
  });
});
