import { randomUUID } from "node:crypto";

import { incidentSnapshotSchema, vendorQuoteSchema, type IncidentEvent } from "@steward/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getIncidentStore, getServiceClient } from "../../../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../../../lib/server/http";

const inputSchema = z
  .object({
    vendorId: z.string().min(1).max(200),
    sourceCallId: z.string().min(1).max(200),
    currency: z.literal("USD"),
    amountMinor: z.number().int().nonnegative().nullable(),
    availability: z.enum(["available", "unavailable", "unknown"]),
    arrivalStartsAt: z.iso.datetime({ offset: true }).nullable(),
    arrivalEndsAt: z.iso.datetime({ offset: true }).nullable(),
    scope: z.string().trim().min(1).max(2_000).nullable(),
    conditions: z.array(z.string().trim().min(1).max(500)).max(20),
    guarantee: z.string().trim().min(1).max(1_000).nullable(),
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  try {
    const { incidentId } = await context.params;
    const input = await parseJson(request, inputSchema);
    const incident = await getIncidentStore().getIncident(incidentId);
    if (incident === null) throw new PublicRequestError(404, "incident_not_found", "That incident was not found.");
    const approved = await getIncidentStore().listApprovedVendors(incident.propertyId);
    if (!approved.some((vendor) => vendor.id === input.vendorId)) {
      throw new PublicRequestError(403, "vendor_not_approved", "The quote must come from an approved vendor.");
    }
    const { data: operations, error } = await getServiceClient()
      .from("provider_operations")
      .select("normalized_result")
      .eq("incident_id", incidentId)
      .eq("operation", "create-outbound-vendor-call");
    if (error !== null) throw error;
    const hasAnsweredCall = (operations ?? []).some((row) => {
      const result = row.normalized_result as { status?: unknown; data?: { callId?: unknown; vendorId?: unknown } } | null;
      return result?.status === "success" && result.data?.callId === input.sourceCallId && result.data?.vendorId === input.vendorId;
    });
    if (!hasAnsweredCall) {
      throw new PublicRequestError(409, "call_not_verified", "A matching answered controlled call is required before recording this quote.");
    }
    const unresolvedFields = [
      ...(input.amountMinor === null ? ["amount"] : []),
      ...(input.availability === "unknown" ? ["availability"] : []),
      ...(input.arrivalStartsAt === null || input.arrivalEndsAt === null ? ["arrivalWindow"] : []),
      ...(input.scope === null ? ["scope"] : []),
      ...(input.guarantee === null ? ["guarantee"] : []),
    ];
    const quote = vendorQuoteSchema.parse({
      version: 1,
      incidentId,
      vendorId: input.vendorId,
      sourceCallId: input.sourceCallId,
      currency: input.currency,
      amountMinor: input.amountMinor,
      availability: input.availability,
      arrivalWindow: input.arrivalStartsAt !== null && input.arrivalEndsAt !== null
        ? { startsAt: input.arrivalStartsAt, endsAt: input.arrivalEndsAt }
        : null,
      scope: input.scope,
      conditions: input.conditions,
      guarantee: input.guarantee,
      unresolvedFields,
      evidenceRefs: [`livekit-call:${input.sourceCallId}`],
    });
    await getIncidentStore().saveVendorQuote(quote);
    const now = new Date().toISOString();
    const selectedSnapshot = incidentSnapshotSchema.parse({ ...incident, selectedVendorId: input.vendorId, state: "scheduled", updatedAt: now });
    const { error: updateError } = await getServiceClient().from("incidents").update({
      selected_vendor_id: input.vendorId,
      state: selectedSnapshot.state,
      snapshot: selectedSnapshot,
      updated_at: now,
    }).eq("id", incidentId);
    if (updateError !== null) throw updateError;
    const quoteEvent: IncidentEvent = {
      version: 1, incidentId, eventId: `event_${randomUUID()}`, occurredAt: now,
      actor: { kind: "system", component: "demo" }, type: "vendor.quote.recorded", payload: { quote },
    };
    await getIncidentStore().appendEvent(quoteEvent);
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
