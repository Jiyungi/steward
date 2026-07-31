import { z } from "zod";

import { eventActorSchema } from "./actors.js";
import { contractIdSchema, contractVersionSchema, evidenceRefSchema, timestampSchema } from "./common.js";
import { incidentHypothesisSchema, incidentSnapshotSchema, incidentStateSchema } from "./incidents.js";
import { verifiedOutcomeSchema } from "./outcomes.js";
import { paymentRecordSchema } from "./payments.js";
import { toolProviderSchema, toolResultSchema } from "./tools.js";
import { vendorQuoteSchema } from "./vendors.js";
import { visionRequestSchema } from "./vision.js";

const eventBaseShape = {
  version: contractVersionSchema,
  incidentId: contractIdSchema,
  eventId: contractIdSchema,
  occurredAt: timestampSchema,
  actor: eventActorSchema,
};

export const incidentCreatedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("incident.created"),
    payload: z.object({ snapshot: incidentSnapshotSchema }).strict(),
  })
  .strict();

export const voiceTurnReceivedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("voice.turn.received"),
    payload: z
      .object({
        turnId: contractIdSchema,
        transcript: z.string().trim().min(1).max(10_000),
        confidence: z.number().min(0).max(1).nullable(),
      })
      .strict(),
  })
  .strict();

export const voiceResponseStartedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("voice.response.started"),
    payload: z.object({ turnId: contractIdSchema, responseId: contractIdSchema }).strict(),
  })
  .strict();

export const voiceInterruptedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("voice.interrupted"),
    payload: z.object({ turnId: contractIdSchema, atCharacter: z.number().int().nonnegative().nullable() }).strict(),
  })
  .strict();

export const incidentGoalUpdatedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("incident.goal.updated"),
    payload: z
      .object({
        previousGoal: z.string().trim().min(1).max(2_000),
        newGoal: z.string().trim().min(1).max(2_000),
      })
      .strict(),
  })
  .strict();

export const incidentHypothesisUpdatedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("incident.hypothesis.updated"),
    payload: z.object({ hypotheses: z.array(incidentHypothesisSchema).max(20) }).strict(),
  })
  .strict();

export const toolStartedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("tool.started"),
    payload: z
      .object({
        operationId: contractIdSchema,
        provider: toolProviderSchema,
        operation: z.string().trim().min(1).max(200),
      })
      .strict(),
  })
  .strict();

export const toolCompletedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("tool.completed"),
    payload: z.object({ result: toolResultSchema }).strict(),
  })
  .strict();

export const visionRequestedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("vision.requested"),
    payload: z.object({ request: visionRequestSchema }).strict(),
  })
  .strict();

export const visionPermissionUpdatedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("vision.permission.updated"),
    payload: z
      .object({
        requestId: contractIdSchema,
        status: z.enum(["accepted", "declined", "failed"]),
      })
      .strict(),
  })
  .strict();

export const evidenceRecordedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("evidence.recorded"),
    payload: z
      .object({
        evidenceRef: evidenceRefSchema,
        kind: z.enum(["photo", "video-frame", "audio", "tool-result", "message", "call-record"]),
        summary: z.string().trim().min(1).max(2_000),
      })
      .strict(),
  })
  .strict();

export const vendorCallStartedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("vendor.call.started"),
    payload: z.object({ vendorId: contractIdSchema, callId: contractIdSchema }).strict(),
  })
  .strict();

export const vendorQuoteRecordedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("vendor.quote.recorded"),
    payload: z.object({ quote: vendorQuoteSchema }).strict(),
  })
  .strict();

export const vendorSelectedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("vendor.selected"),
    payload: z.object({ vendorId: contractIdSchema, quoteSourceCallId: contractIdSchema }).strict(),
  })
  .strict();

export const paymentStartedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("payment.started"),
    payload: z.object({ payment: paymentRecordSchema }).strict(),
  })
  .strict();

export const paymentUpdatedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("payment.updated"),
    payload: z.object({ payment: paymentRecordSchema }).strict(),
  })
  .strict();

export const incidentStateChangedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("incident.state.changed"),
    payload: z
      .object({
        from: incidentStateSchema,
        to: incidentStateSchema,
        reason: z.string().trim().min(1).max(1_000),
      })
      .strict(),
  })
  .strict();

export const incidentResolvedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("incident.resolved"),
    payload: z.object({ outcome: verifiedOutcomeSchema }).strict(),
  })
  .strict();

export const incidentEscalatedEventSchema = z
  .object({
    ...eventBaseShape,
    type: z.literal("incident.escalated"),
    payload: z
      .object({
        reason: z.string().trim().min(1).max(1_000),
        target: z.enum(["owner", "emergency-services", "property-manager", "manual-review"]),
      })
      .strict(),
  })
  .strict();

export const incidentEventSchema = z.discriminatedUnion("type", [
  incidentCreatedEventSchema,
  voiceTurnReceivedEventSchema,
  voiceResponseStartedEventSchema,
  voiceInterruptedEventSchema,
  incidentGoalUpdatedEventSchema,
  incidentHypothesisUpdatedEventSchema,
  toolStartedEventSchema,
  toolCompletedEventSchema,
  visionRequestedEventSchema,
  visionPermissionUpdatedEventSchema,
  evidenceRecordedEventSchema,
  vendorCallStartedEventSchema,
  vendorQuoteRecordedEventSchema,
  vendorSelectedEventSchema,
  paymentStartedEventSchema,
  paymentUpdatedEventSchema,
  incidentStateChangedEventSchema,
  incidentResolvedEventSchema,
  incidentEscalatedEventSchema,
]);

export type IncidentEvent = z.infer<typeof incidentEventSchema>;
export type IncidentEventType = IncidentEvent["type"];
