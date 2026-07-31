import { z } from "zod";

import { contractIdSchema, contractVersionSchema, timestampSchema } from "./common.js";

export const visionRequestStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "failed",
  "completed",
]);

export const visionRequestSchema = z
  .object({
    version: contractVersionSchema,
    id: contractIdSchema,
    incidentId: contractIdSchema,
    question: z.string().trim().min(1).max(1_000),
    explanation: z.string().trim().min(1).max(1_000),
    requestedEvidence: z.enum(["live-camera", "photo"]),
    status: visionRequestStatusSchema,
    createdAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (Date.parse(request.expiresAt) <= Date.parse(request.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "expiresAt must be later than createdAt",
      });
    }
  });

export type VisionRequest = z.infer<typeof visionRequestSchema>;
