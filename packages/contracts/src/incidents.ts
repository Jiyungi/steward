import { z } from "zod";

import {
  contractIdSchema,
  contractVersionSchema,
  currencySchema,
  evidenceRefsSchema,
  timestampSchema,
} from "./common.js";
import { verifiedOutcomeSchema } from "./outcomes.js";

export const incidentStateSchema = z.enum([
  "reported",
  "triaging",
  "diagnosing",
  "sourcing",
  "vendor-contacting",
  "scheduled",
  "verification-pending",
  "resolved",
  "failed",
  "escalated",
]);

export type IncidentState = z.infer<typeof incidentStateSchema>;

export const incidentRiskSchema = z.enum(["unknown", "low", "medium", "high", "emergency"]);

export const incidentHypothesisSchema = z
  .object({
    label: z.string().trim().min(1).max(500),
    confidence: z.number().min(0).max(1),
    evidenceRefs: evidenceRefsSchema,
  })
  .strict();

export type IncidentHypothesis = z.infer<typeof incidentHypothesisSchema>;

export const incidentSnapshotSchema = z
  .object({
    version: contractVersionSchema,
    id: contractIdSchema,
    propertyId: contractIdSchema,
    bookingId: contractIdSchema.nullable(),
    guestSessionId: contractIdSchema,
    goal: z.string().trim().min(1).max(2_000),
    state: incidentStateSchema,
    risk: incidentRiskSchema,
    budget: z
      .object({
        currency: currencySchema,
        authorizedMinor: z.number().int().nonnegative(),
        spentMinor: z.number().int().nonnegative(),
      })
      .strict(),
    activeHypotheses: z.array(incidentHypothesisSchema).max(20),
    pendingOperations: z.array(contractIdSchema).max(100),
    selectedVendorId: contractIdSchema.nullable(),
    outcome: verifiedOutcomeSchema.nullable(),
    updatedAt: timestampSchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.budget.spentMinor > snapshot.budget.authorizedMinor) {
      context.addIssue({
        code: "custom",
        path: ["budget", "spentMinor"],
        message: "spentMinor cannot exceed authorizedMinor",
      });
    }

    if (snapshot.state === "resolved" && snapshot.outcome === null) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "A resolved incident requires a verified outcome",
      });
    }

    if (snapshot.state !== "resolved" && snapshot.outcome !== null) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "Only a resolved incident can contain a verified outcome",
      });
    }
  });

export type IncidentSnapshot = z.infer<typeof incidentSnapshotSchema>;
