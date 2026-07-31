import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getIncidentStore } from "../../../../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../../../../lib/server/http";
import { getProviders } from "../../../../../../lib/server/providers";

const schema = z.object({ vendorId: z.string().min(1).max(200), idempotencyKey: z.string().min(8).max(200) }).strict();

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  try {
    const { incidentId } = await context.params;
    const input = await parseJson(request, schema);
    const incident = await getIncidentStore().getIncident(incidentId);
    if (incident === null) throw new PublicRequestError(404, "incident_not_found", "That incident was not found.");
    const approved = await getIncidentStore().listApprovedVendors(incident.propertyId);
    const vendor = approved.find((candidate) => candidate.id === input.vendorId);
    if (vendor === undefined) {
      throw new PublicRequestError(403, "vendor_not_approved", "Only an approved property vendor can be called.");
    }
    const contact = await getIncidentStore().getControlledContact(vendor.contactId);
    if (contact === null) throw new PublicRequestError(404, "contact_not_found", "The vendor contact is unavailable.");
    const operationId = `op_${randomUUID()}`;
    const result = await getProviders().telephony.createOutboundVendorCall({
      incidentId,
      operationId,
      idempotencyKey: input.idempotencyKey,
      vendorId: vendor.id,
      vendorName: vendor.name,
      contact,
    });
    if (result.status === "success" && result.data !== undefined) {
      const evidenceId = `livekit-call:${result.data.callId}`;
      await getIncidentStore().addEvidence({
        id: evidenceId,
        incidentId,
        kind: "call-record",
        summary: "LiveKit confirmed the controlled vendor answered; job acceptance and quote remain unverified.",
        submittedBy: "livekit-sip",
        verifiedBy: "tool",
        createdAt: result.completedAt,
      });
    }
    return NextResponse.json({ result }, { status: result.status === "success" ? 200 : 422 });
  } catch (error) {
    return apiError(error);
  }
}
