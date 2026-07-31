import { z } from "zod";

import { contractIdSchema, contractVersionSchema, timestampSchema } from "./common.js";

export const actorClaimSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("owner"),
      identityId: contractIdSchema,
      ownerId: contractIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("vendor"),
      identityId: contractIdSchema,
      vendorId: contractIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("guest"),
      identityId: contractIdSchema,
      guestSessionId: contractIdSchema,
      bookingId: contractIdSchema.nullable(),
      demo: z.boolean(),
      expiresAt: timestampSchema,
    })
    .strict(),
]);

export type ActorClaim = z.infer<typeof actorClaimSchema>;

export const systemActorSchema = z
  .object({
    kind: z.literal("system"),
    component: z.enum(["agent", "webhook", "scheduler", "demo"]),
  })
  .strict();

export const eventActorSchema = z.union([actorClaimSchema, systemActorSchema]);

export type EventActor = z.infer<typeof eventActorSchema>;

export const guestLinkClaimSchema = z
  .object({
    version: contractVersionSchema,
    kind: z.literal("booking"),
    guestSessionId: contractIdSchema,
    propertyId: contractIdSchema,
    bookingId: contractIdSchema,
    emailHash: z.string().trim().min(32).max(128),
    issuedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict()
  .superRefine((claim, context) => {
    if (Date.parse(claim.expiresAt) <= Date.parse(claim.issuedAt)) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "expiresAt must be later than issuedAt",
      });
    }
  });

export type GuestLinkClaim = z.infer<typeof guestLinkClaimSchema>;

export const demoGuestSessionSchema = z
  .object({
    version: contractVersionSchema,
    id: contractIdSchema,
    propertyId: contractIdSchema,
    emailHash: z.string().trim().min(32).max(128),
    verifiedAt: timestampSchema,
    expiresAt: timestampSchema,
    demo: z.literal(true),
  })
  .strict()
  .superRefine((session, context) => {
    if (Date.parse(session.expiresAt) <= Date.parse(session.verifiedAt)) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "expiresAt must be later than verifiedAt",
      });
    }
  });

export type DemoGuestSession = z.infer<typeof demoGuestSessionSchema>;
