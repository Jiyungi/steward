import { z } from "zod";

export const contractVersionSchema = z.literal(1);

export const contractIdSchema = z.string().trim().min(1).max(200);

export const timestampSchema = z.iso.datetime({ offset: true });

export const currencySchema = z.string().regex(/^[A-Z]{3}$/, "Use an ISO 4217 currency code");

export const evidenceRefSchema = z.string().trim().min(1).max(500);

export const evidenceRefsSchema = z.array(evidenceRefSchema).max(100);

export const safeErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    safeMessage: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
  })
  .strict();

export type SafeError = z.infer<typeof safeErrorSchema>;

export function isAtOrAfter(candidate: string, reference: string): boolean {
  return Date.parse(candidate) >= Date.parse(reference);
}
