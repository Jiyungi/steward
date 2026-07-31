import { z } from "zod";

import { evidenceRefsSchema, timestampSchema } from "./common.js";

export const resolutionTypeSchema = z.enum([
  "troubleshot",
  "vendor",
  "compensation",
  "alternative",
  "escalated",
]);

export const verifiedOutcomeSchema = z
  .object({
    summary: z.string().trim().min(1).max(2_000),
    resolutionType: resolutionTypeSchema,
    evidenceRefs: evidenceRefsSchema,
    verifiedAt: timestampSchema,
    verifiedBy: z.enum(["guest", "vendor", "agent-vision", "tool", "owner"]),
  })
  .strict();

export type VerifiedOutcome = z.infer<typeof verifiedOutcomeSchema>;
