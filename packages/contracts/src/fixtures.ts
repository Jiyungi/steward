import { z } from "zod";

import {
  actorClaimSchema,
  demoGuestSessionSchema,
  guestLinkClaimSchema,
} from "./actors.js";
import { contractVersionSchema } from "./common.js";
import { incidentEventSchema } from "./events.js";
import { connectionStateSchema } from "./frontend.js";
import { incidentSnapshotSchema } from "./incidents.js";
import { verifiedOutcomeSchema } from "./outcomes.js";
import { paymentRecordSchema } from "./payments.js";
import { toolResultSchema } from "./tools.js";
import { vendorQuoteSchema } from "./vendors.js";
import { visionRequestSchema } from "./vision.js";
import { voiceStatusEventSchema } from "./voice.js";

const T0 = "2030-01-15T18:00:00.000Z";
const T1 = "2030-01-15T18:00:01.000Z";
const T2 = "2030-01-15T18:00:02.000Z";
const T3 = "2030-01-15T18:00:03.000Z";
const T4 = "2030-01-15T18:00:04.000Z";
const T5 = "2030-01-15T18:00:05.000Z";

export const validActorClaim = actorClaimSchema.parse({
  kind: "guest",
  identityId: "identity-guest-1",
  guestSessionId: "guest-session-1",
  bookingId: "booking-1",
  demo: false,
  expiresAt: "2030-01-30T18:00:00.000Z",
});

export const validGuestLinkClaim = guestLinkClaimSchema.parse({
  version: 1,
  kind: "booking",
  guestSessionId: "guest-session-1",
  propertyId: "property-1",
  bookingId: "booking-1",
  emailHash: "9b74c9897bac770ffc029102a200c5de",
  issuedAt: T0,
  expiresAt: "2030-01-30T18:00:00.000Z",
});

export const validDemoGuestSession = demoGuestSessionSchema.parse({
  version: 1,
  id: "demo-session-1",
  propertyId: "demo-property-1",
  emailHash: "9b74c9897bac770ffc029102a200c5de",
  verifiedAt: T0,
  expiresAt: "2030-01-15T19:00:00.000Z",
  demo: true,
});

export const validVerifiedOutcome = verifiedOutcomeSchema.parse({
  summary: "The guest confirmed the lock opened after replacing the battery.",
  resolutionType: "troubleshot",
  evidenceRefs: ["evidence://guest-confirmation/1"],
  verifiedAt: T5,
  verifiedBy: "guest",
});

export const validIncidentSnapshot = incidentSnapshotSchema.parse({
  version: 1,
  id: "incident-1",
  propertyId: "property-1",
  bookingId: "booking-1",
  guestSessionId: "guest-session-1",
  goal: "Help the guest enter the property safely.",
  state: "diagnosing",
  risk: "low",
  budget: { currency: "USD", authorizedMinor: 20_000, spentMinor: 0 },
  activeHypotheses: [
    {
      label: "The keypad battery may be depleted.",
      confidence: 0.65,
      evidenceRefs: ["evidence://voice-turn/1"],
    },
  ],
  pendingOperations: [],
  selectedVendorId: null,
  outcome: null,
  updatedAt: T1,
});

export const validToolResult = toolResultSchema.parse({
  version: 1,
  incidentId: "incident-1",
  operationId: "operation-1",
  provider: "a1mobile",
  operation: "placeCall",
  status: "success",
  startedAt: T1,
  completedAt: T2,
  data: { callId: "call-1" },
  evidenceRefs: ["evidence://tool-result/1"],
});

export const validVisionRequest = visionRequestSchema.parse({
  version: 1,
  id: "vision-request-1",
  incidentId: "incident-1",
  question: "Please point the camera at the keypad so I can read its current indicator lights.",
  explanation: "The lights can distinguish a low battery from a rejected code.",
  requestedEvidence: "live-camera",
  status: "pending",
  createdAt: T2,
  expiresAt: "2030-01-15T18:05:02.000Z",
});

export const validVoiceStatusEvent = voiceStatusEventSchema.parse({
  version: 1,
  incidentId: "incident-1",
  state: "tool-pending",
  operationId: "operation-1",
  safeLabel: "Calling the approved locksmith",
  occurredAt: T3,
});

export const validVendorQuote = vendorQuoteSchema.parse({
  version: 1,
  incidentId: "incident-1",
  vendorId: "vendor-1",
  sourceCallId: "call-1",
  currency: "USD",
  amountMinor: 12_500,
  availability: "available",
  arrivalWindow: {
    startsAt: "2030-01-15T18:30:00.000Z",
    endsAt: "2030-01-15T19:00:00.000Z",
  },
  scope: "Replace the keypad battery and verify guest entry.",
  conditions: ["Price excludes replacement hardware."],
  guarantee: "Thirty-day workmanship guarantee.",
  unresolvedFields: [],
  evidenceRefs: ["evidence://vendor-call/1"],
});

export const validPaymentRecord = paymentRecordSchema.parse({
  version: 1,
  id: "payment-1",
  incidentId: "incident-1",
  vendorId: "vendor-1",
  provider: "stripe",
  providerPaymentId: "pi_test_1",
  currency: "USD",
  amountMinor: 12_500,
  status: "succeeded",
  idempotencyKey: "incident-1-vendor-1-quote-1",
  testMode: true,
  createdAt: T3,
  updatedAt: T4,
  evidenceRefs: ["evidence://stripe/payment-1"],
});

export const validIncidentEvent = incidentEventSchema.parse({
  version: 1,
  incidentId: "incident-1",
  eventId: "event-1",
  occurredAt: T0,
  actor: { kind: "system", component: "agent" },
  type: "incident.created",
  payload: { snapshot: validIncidentSnapshot },
});

export const guestTimelineFrameSchema = z
  .object({
    version: contractVersionSchema,
    atMs: z.number().int().nonnegative(),
    connection: connectionStateSchema,
    incident: incidentSnapshotSchema,
    voice: voiceStatusEventSchema.nullable(),
    visionRequest: visionRequestSchema.nullable(),
    notice: z.string().trim().min(1).max(500).nullable(),
  })
  .strict();

export type GuestTimelineFrame = z.infer<typeof guestTimelineFrameSchema>;

export const guestScenarioFixtureSchema = z
  .object({
    version: contractVersionSchema,
    name: z.string().trim().min(1).max(100),
    access: z.enum(["active", "expired"]),
    frames: z.array(guestTimelineFrameSchema).min(1),
  })
  .strict();

export type GuestScenarioFixture = z.infer<typeof guestScenarioFixtureSchema>;

function incidentAt(
  state: "diagnosing" | "vendor-contacting" | "resolved" | "failed",
  updatedAt: string,
) {
  return incidentSnapshotSchema.parse({
    ...validIncidentSnapshot,
    state,
    updatedAt,
    pendingOperations: state === "vendor-contacting" ? ["operation-1"] : [],
    outcome: state === "resolved" ? validVerifiedOutcome : null,
  });
}

function voiceAt(
  state: "listening" | "thinking" | "tool-pending" | "camera-requested" | "disconnected" | "ended",
  occurredAt: string,
) {
  return voiceStatusEventSchema.parse({
    version: 1,
    incidentId: "incident-1",
    state,
    ...(state === "tool-pending" ? { operationId: "operation-1" } : {}),
    safeLabel:
      state === "tool-pending"
        ? "Calling an approved vendor"
        : state === "camera-requested"
          ? "Waiting for camera permission"
          : state === "disconnected"
            ? "Reconnecting the call"
            : state === "ended"
              ? "Issue resolved"
              : state === "thinking"
                ? "Checking the next safe step"
                : "Listening",
    occurredAt,
  });
}

export const guestScenarioFixtures = {
  resolved: guestScenarioFixtureSchema.parse({
    version: 1,
    name: "resolved",
    access: "active",
    frames: [
      { version: 1, atMs: 0, connection: "connected", incident: incidentAt("diagnosing", T0), voice: voiceAt("listening", T0), visionRequest: null, notice: null },
      { version: 1, atMs: 800, connection: "connected", incident: incidentAt("diagnosing", T1), voice: voiceAt("thinking", T1), visionRequest: null, notice: null },
      { version: 1, atMs: 1_600, connection: "connected", incident: incidentAt("vendor-contacting", T2), voice: voiceAt("tool-pending", T2), visionRequest: null, notice: null },
      { version: 1, atMs: 2_400, connection: "connected", incident: incidentAt("diagnosing", T3), voice: voiceAt("camera-requested", T3), visionRequest: validVisionRequest, notice: null },
      { version: 1, atMs: 3_200, connection: "connected", incident: incidentAt("resolved", T5), voice: voiceAt("ended", T5), visionRequest: null, notice: "The guest verified that the door opened." },
    ],
  }),
  cameraDenied: guestScenarioFixtureSchema.parse({
    version: 1,
    name: "camera-denied",
    access: "active",
    frames: [
      { version: 1, atMs: 0, connection: "connected", incident: incidentAt("diagnosing", T2), voice: voiceAt("camera-requested", T2), visionRequest: validVisionRequest, notice: null },
      { version: 1, atMs: 1_000, connection: "connected", incident: incidentAt("diagnosing", T3), voice: voiceAt("listening", T3), visionRequest: { ...validVisionRequest, status: "declined" }, notice: "Camera access was declined. Voice troubleshooting is still available." },
    ],
  }),
  reconnecting: guestScenarioFixtureSchema.parse({
    version: 1,
    name: "reconnecting",
    access: "active",
    frames: [
      { version: 1, atMs: 0, connection: "reconnecting", incident: incidentAt("diagnosing", T2), voice: voiceAt("disconnected", T2), visionRequest: null, notice: "Reconnecting…" },
      { version: 1, atMs: 1_500, connection: "connected", incident: incidentAt("diagnosing", T3), voice: voiceAt("listening", T3), visionRequest: null, notice: "Call restored." },
    ],
  }),
  failed: guestScenarioFixtureSchema.parse({
    version: 1,
    name: "failed",
    access: "active",
    frames: [
      { version: 1, atMs: 0, connection: "failed", incident: incidentAt("failed", T4), voice: voiceAt("ended", T4), visionRequest: null, notice: "The call could not reconnect. Try again or use the property contact." },
    ],
  }),
  expiredLink: guestScenarioFixtureSchema.parse({
    version: 1,
    name: "expired-link",
    access: "expired",
    frames: [
      { version: 1, atMs: 0, connection: "disconnected", incident: incidentAt("failed", T4), voice: null, visionRequest: null, notice: "This guest link has expired." },
    ],
  }),
} as const;

export interface ContractFixtureCase {
  name: string;
  schema: z.ZodType;
  valid: unknown;
  boundary: unknown;
  invalid: unknown;
}

export const contractFixtureCases: readonly ContractFixtureCase[] = [
  {
    name: "ActorClaim",
    schema: actorClaimSchema,
    valid: validActorClaim,
    boundary: { kind: "owner", identityId: "i", ownerId: "o" },
    invalid: { kind: "guest", identityId: "i", guestSessionId: "g", bookingId: null, demo: false },
  },
  {
    name: "GuestLinkClaim",
    schema: guestLinkClaimSchema,
    valid: validGuestLinkClaim,
    boundary: { ...validGuestLinkClaim, expiresAt: "2030-01-15T18:00:00.001Z" },
    invalid: { ...validGuestLinkClaim, version: 2 },
  },
  {
    name: "DemoGuestSession",
    schema: demoGuestSessionSchema,
    valid: validDemoGuestSession,
    boundary: { ...validDemoGuestSession, expiresAt: "2030-01-15T18:00:00.001Z" },
    invalid: { ...validDemoGuestSession, demo: false },
  },
  {
    name: "VerifiedOutcome",
    schema: verifiedOutcomeSchema,
    valid: validVerifiedOutcome,
    boundary: { ...validVerifiedOutcome, summary: "x", evidenceRefs: [] },
    invalid: { ...validVerifiedOutcome, resolutionType: "guessed" },
  },
  {
    name: "IncidentSnapshot",
    schema: incidentSnapshotSchema,
    valid: validIncidentSnapshot,
    boundary: { ...validIncidentSnapshot, activeHypotheses: [], budget: { currency: "USD", authorizedMinor: 0, spentMinor: 0 } },
    invalid: { ...validIncidentSnapshot, state: "resolved", outcome: null },
  },
  {
    name: "ToolResult",
    schema: toolResultSchema,
    valid: validToolResult,
    boundary: { ...validToolResult, status: "timeout", completedAt: T1, data: undefined, error: { code: "TIMEOUT", safeMessage: "The provider did not respond.", retryable: true } },
    invalid: { ...validToolResult, providerPayload: { secret: true } },
  },
  {
    name: "VisionRequest",
    schema: visionRequestSchema,
    valid: validVisionRequest,
    boundary: { ...validVisionRequest, expiresAt: "2030-01-15T18:00:02.001Z" },
    invalid: { ...validVisionRequest, expiresAt: T2 },
  },
  {
    name: "VoiceStatusEvent",
    schema: voiceStatusEventSchema,
    valid: validVoiceStatusEvent,
    boundary: { version: 1, incidentId: "i", state: "ended", occurredAt: T0 },
    invalid: { version: 1, incidentId: "i", state: "tool-pending", occurredAt: T0 },
  },
  {
    name: "VendorQuote",
    schema: vendorQuoteSchema,
    valid: validVendorQuote,
    boundary: { ...validVendorQuote, amountMinor: null, availability: "unavailable", arrivalWindow: null, scope: null, conditions: [], guarantee: null, unresolvedFields: ["amountMinor"] },
    invalid: { ...validVendorQuote, amountMinor: -1 },
  },
  {
    name: "PaymentRecord",
    schema: paymentRecordSchema,
    valid: validPaymentRecord,
    boundary: { ...validPaymentRecord, amountMinor: 0, status: "pending", providerPaymentId: null },
    invalid: { ...validPaymentRecord, testMode: false },
  },
  {
    name: "IncidentEvent",
    schema: incidentEventSchema,
    valid: validIncidentEvent,
    boundary: { version: 1, incidentId: "i", eventId: "e", occurredAt: T0, actor: { kind: "system", component: "agent" }, type: "incident.escalated", payload: { reason: "Safety risk", target: "owner" } },
    invalid: { ...validIncidentEvent, version: 2 },
  },
  {
    name: "GuestScenarioFixture",
    schema: guestScenarioFixtureSchema,
    valid: guestScenarioFixtures.resolved,
    boundary: guestScenarioFixtures.expiredLink,
    invalid: { version: 1, name: "empty", access: "active", frames: [] },
  },
];
