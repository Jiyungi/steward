import { z } from "zod";

import {
  contractIdSchema,
  contractVersionSchema,
  currencySchema,
  evidenceRefsSchema,
  timestampSchema,
} from "./common.js";

export const vendorQuoteSchema = z
  .object({
    version: contractVersionSchema,
    incidentId: contractIdSchema,
    vendorId: contractIdSchema,
    sourceCallId: contractIdSchema,
    currency: currencySchema,
    amountMinor: z.number().int().nonnegative().nullable(),
    availability: z.enum(["available", "unavailable", "unknown"]),
    arrivalWindow: z
      .object({
        startsAt: timestampSchema,
        endsAt: timestampSchema,
      })
      .strict()
      .nullable(),
    scope: z.string().trim().min(1).max(2_000).nullable(),
    conditions: z.array(z.string().trim().min(1).max(500)).max(50),
    guarantee: z.string().trim().min(1).max(1_000).nullable(),
    unresolvedFields: z.array(z.string().trim().min(1).max(100)).max(50),
    evidenceRefs: evidenceRefsSchema,
  })
  .strict()
  .superRefine((quote, context) => {
    if (
      quote.arrivalWindow !== null &&
      Date.parse(quote.arrivalWindow.endsAt) < Date.parse(quote.arrivalWindow.startsAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["arrivalWindow", "endsAt"],
        message: "endsAt must be at or after startsAt",
      });
    }
  });

export type VendorQuote = z.infer<typeof vendorQuoteSchema>;
