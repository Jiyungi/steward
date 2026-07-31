import { z } from "zod";

import {
  contractIdSchema,
  contractVersionSchema,
  currencySchema,
  evidenceRefsSchema,
  safeErrorSchema,
  timestampSchema,
} from "./common.js";

export const paymentStatusSchema = z.enum([
  "pending",
  "requires-action",
  "processing",
  "succeeded",
  "failed",
  "canceled",
]);

export const paymentRecordSchema = z
  .object({
    version: contractVersionSchema,
    id: contractIdSchema,
    incidentId: contractIdSchema,
    vendorId: contractIdSchema.nullable(),
    provider: z.literal("stripe"),
    providerPaymentId: contractIdSchema.nullable(),
    currency: currencySchema,
    amountMinor: z.number().int().nonnegative(),
    status: paymentStatusSchema,
    idempotencyKey: contractIdSchema,
    testMode: z.literal(true),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    evidenceRefs: evidenceRefsSchema,
    error: safeErrorSchema.optional(),
  })
  .strict()
  .superRefine((payment, context) => {
    if (Date.parse(payment.updatedAt) < Date.parse(payment.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "updatedAt must be at or after createdAt",
      });
    }

    if (payment.status === "failed" && payment.error === undefined) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A failed payment requires a safe error",
      });
    }

    if (payment.status === "succeeded" && payment.error !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A successful payment cannot contain an error",
      });
    }
  });

export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
