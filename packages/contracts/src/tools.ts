import { z } from "zod";

import {
  contractIdSchema,
  contractVersionSchema,
  evidenceRefsSchema,
  safeErrorSchema,
  timestampSchema,
} from "./common.js";

export const toolProviderSchema = z.enum([
  "a1mobile",
  "livekit",
  "supabase",
  "stripe",
  "google-places",
]);

export const toolStatusSchema = z.enum([
  "success",
  "partial",
  "failure",
  "timeout",
  "canceled",
  "unknown",
]);

export function createToolResultSchema<T extends z.ZodType>(dataSchema: T) {
  return z
    .object({
      version: contractVersionSchema,
      incidentId: contractIdSchema,
      operationId: contractIdSchema,
      provider: toolProviderSchema,
      operation: z.string().trim().min(1).max(200),
      status: toolStatusSchema,
      startedAt: timestampSchema,
      completedAt: timestampSchema,
      data: dataSchema.optional(),
      error: safeErrorSchema.optional(),
      evidenceRefs: evidenceRefsSchema,
    })
    .strict()
    .superRefine((result, context) => {
      if (Date.parse(result.completedAt) < Date.parse(result.startedAt)) {
        context.addIssue({
          code: "custom",
          path: ["completedAt"],
          message: "completedAt must be at or after startedAt",
        });
      }

      if (result.status === "success" && result.error !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["error"],
          message: "A successful result cannot contain an error",
        });
      }

      if (["failure", "timeout", "canceled"].includes(result.status) && result.error === undefined) {
        context.addIssue({
          code: "custom",
          path: ["error"],
          message: `A ${result.status} result requires a safe error`,
        });
      }
    });
}

export const toolResultSchema = createToolResultSchema(z.unknown());

type ToolResultBase = z.infer<typeof toolResultSchema>;

export type ToolResult<T = unknown> = Omit<ToolResultBase, "data"> & { data?: T };
