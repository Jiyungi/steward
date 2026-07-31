import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { DEMO_PROPERTY_ID } from "../../../../../lib/server/demo";
import { getIncidentStore } from "../../../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../../../lib/server/http";
import { getProviders } from "../../../../../lib/server/providers";

const requestSchema = z
  .object({
    incidentId: z.string().trim().min(1).max(200),
    contactId: z.string().trim().min(1).max(200),
    code: z.string().regex(/^\d{4,8}$/),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, requestSchema);
    const contact = await getIncidentStore().getControlledContact(input.contactId);
    if (contact === null) throw new PublicRequestError(404, "contact_not_found", "Request a verification code first.");
    const result = await getProviders().a1.confirmPhoneVerification({
      incidentId: input.incidentId,
      operationId: `op_${randomUUID()}`,
      idempotencyKey: input.idempotencyKey,
      phoneE164: contact.phoneE164,
      code: input.code,
    });
    if (result.status !== "success") return NextResponse.json({ result }, { status: 422 });

    const verifiedAt = new Date().toISOString();
    const verified = await getIncidentStore().upsertControlledContact({
      ...contact,
      verificationStatus: "verified",
      verifiedAt,
      updatedAt: verifiedAt,
    });
    const vendorId = `vendor_${verified.id.replace(/^contact_/, "")}`;
    const vendor = await getIncidentStore().saveApprovedVendor({
      id: vendorId,
      propertyId: DEMO_PROPERTY_ID,
      contactId: verified.id,
      name: verified.label,
      serviceCategories: ["general-maintenance"],
      priority: 1,
      policyNotes: "OTP-verified controlled demo vendor",
      active: true,
    });
    return NextResponse.json({ result, contact: { id: verified.id, label: verified.label, phoneLast4: verified.phoneE164.slice(-4), verificationStatus: verified.verificationStatus }, vendor });
  } catch (error) {
    return apiError(error);
  }
}
