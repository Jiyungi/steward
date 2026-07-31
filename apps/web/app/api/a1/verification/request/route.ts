import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getIncidentStore } from "../../../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../../../lib/server/http";
import { getProviders } from "../../../../../lib/server/providers";

const requestSchema = z
  .object({
    incidentId: z.string().trim().min(1).max(200),
    phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/),
    label: z.string().trim().min(1).max(100),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

function contactId(phone: string) {
  return `contact_${createHash("sha256").update(phone).digest("hex").slice(0, 24)}`;
}

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, requestSchema);
    if (await getIncidentStore().getIncident(input.incidentId) === null) {
      throw new PublicRequestError(404, "incident_not_found", "Create an incident before verifying a contact.");
    }
    const now = new Date().toISOString();
    const id = contactId(input.phoneE164);
    const existing = await getIncidentStore().getControlledContact(id);
    await getIncidentStore().upsertControlledContact({
      id,
      phoneE164: input.phoneE164,
      label: input.label,
      verificationStatus: existing?.verificationStatus === "verified" ? "verified" : "pending",
      organizerControlled: false,
      verifiedAt: existing?.verifiedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    const result = await getProviders().a1.requestPhoneVerification({
      incidentId: input.incidentId,
      operationId: `op_${randomUUID()}`,
      idempotencyKey: input.idempotencyKey,
      phoneE164: input.phoneE164,
    });
    return NextResponse.json({ result, contactId: id, phoneLast4: input.phoneE164.slice(-4) }, { status: result.status === "success" ? 200 : 502 });
  } catch (error) {
    return apiError(error);
  }
}
