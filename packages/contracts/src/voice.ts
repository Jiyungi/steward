import { z } from "zod";

import { contractIdSchema, contractVersionSchema, timestampSchema } from "./common.js";

export const voiceStateSchema = z.enum([
  "listening",
  "thinking",
  "speaking",
  "tool-pending",
  "camera-requested",
  "disconnected",
  "ended",
]);

export const voiceStatusEventSchema = z
  .object({
    version: contractVersionSchema,
    incidentId: contractIdSchema,
    state: voiceStateSchema,
    operationId: contractIdSchema.optional(),
    safeLabel: z.string().trim().min(1).max(200).optional(),
    occurredAt: timestampSchema,
  })
  .strict()
  .superRefine((event, context) => {
    if (event.state === "tool-pending" && event.operationId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["operationId"],
        message: "tool-pending requires an operationId",
      });
    }
  });

export type VoiceStatusEvent = z.infer<typeof voiceStatusEventSchema>;
