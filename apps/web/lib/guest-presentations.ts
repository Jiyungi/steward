import {
  guestScenarioFixtureSchema,
  guestScenarioFixtures,
  incidentSnapshotSchema,
  validIncidentSnapshot,
  validVerifiedOutcome,
  validVisionRequest,
  voiceStatusEventSchema,
  type GuestScenarioFixture,
  type GuestTimelineFrame,
  type IncidentState,
  type VoiceStatusEvent,
} from "@steward/contracts";

const timestamp = "2030-01-15T18:00:03.000Z";

function incident(state: IncidentState) {
  return incidentSnapshotSchema.parse({
    ...validIncidentSnapshot,
    goal: "Understand the property issue and identify the next safe action.",
    state,
    updatedAt: timestamp,
    pendingOperations: state === "vendor-contacting" ? ["operation-presentation"] : [],
    outcome: state === "resolved" ? validVerifiedOutcome : null,
  });
}

function voice(state: VoiceStatusEvent["state"], safeLabel: string): VoiceStatusEvent {
  return voiceStatusEventSchema.parse({
    version: 1,
    incidentId: validIncidentSnapshot.id,
    state,
    ...(state === "tool-pending" ? { operationId: "operation-presentation" } : {}),
    safeLabel,
    occurredAt: timestamp,
  });
}

function scenario(
  name: string,
  frame: Omit<GuestTimelineFrame, "version" | "atMs">,
): GuestScenarioFixture {
  return guestScenarioFixtureSchema.parse({
    version: 1,
    name,
    access: "active",
    frames: [{ version: 1, atMs: 0, ...frame }],
  });
}

const localPresentationFixtures = {
  connecting: scenario("connecting", {
    connection: "connecting",
    incident: incident("reported"),
    voice: null,
    visionRequest: null,
    notice: "Preparing a secure voice connection.",
  }),
  connected: scenario("connected", {
    connection: "connected",
    incident: incident("diagnosing"),
    voice: voice("listening", "Listening"),
    visionRequest: null,
    notice: null,
  }),
  speaking: scenario("speaking", {
    connection: "connected",
    incident: incident("diagnosing"),
    voice: voice("speaking", "Explaining the next safe step"),
    visionRequest: null,
    notice: null,
  }),
  vendorPending: scenario("vendor-action-pending", {
    connection: "connected",
    incident: incident("vendor-contacting"),
    voice: voice("tool-pending", "Contacting an approved property partner"),
    visionRequest: null,
    notice: "No vendor acceptance or arrival time has been confirmed yet.",
  }),
  cameraRequested: scenario("camera-requested", {
    connection: "connected",
    incident: incident("diagnosing"),
    voice: voice("camera-requested", "Waiting for your camera choice"),
    visionRequest: {
      ...validVisionRequest,
      question: "Please show Steward what you are looking at right now.",
      explanation:
        "A live view may reduce uncertainty before Steward suggests another step or contacts help.",
    },
    notice: null,
  }),
  disconnected: scenario("disconnected", {
    connection: "disconnected",
    incident: incident("diagnosing"),
    voice: voice("disconnected", "Voice connection paused"),
    visionRequest: null,
    notice: "The incident remains open. You can try the voice connection again.",
  }),
  escalated: scenario("escalated", {
    connection: "disconnected",
    incident: incident("escalated"),
    voice: voice("ended", "Incident handed off without a verified resolution"),
    visionRequest: null,
    notice: "Steward could not verify a resolution. The property contact needs to continue from here.",
  }),
} as const;

export const guestPresentations = {
  resolved: guestScenarioFixtures.resolved,
  cameraDenied: guestScenarioFixtures.cameraDenied,
  reconnecting: guestScenarioFixtures.reconnecting,
  failed: guestScenarioFixtures.failed,
  expiredLink: guestScenarioFixtures.expiredLink,
  ...localPresentationFixtures,
} satisfies Record<string, GuestScenarioFixture>;

export type GuestFixtureName = keyof typeof guestPresentations;

export const guestFixtureNames = Object.keys(guestPresentations) as GuestFixtureName[];

export function getGuestPresentation(name: string | undefined): GuestScenarioFixture {
  if (name !== undefined && name in guestPresentations) {
    return guestPresentations[name as GuestFixtureName];
  }
  return guestPresentations.connected;
}
