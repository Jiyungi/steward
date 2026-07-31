import { randomUUID } from "node:crypto";

import { vendorQuoteSchema } from "@steward/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getIncidentStore, getServiceClient } from "../../../../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../../../../lib/server/http";
import { getProviders } from "../../../../../../lib/server/providers";

const schema = z.object({ vendorId: z.string().min(1).max(200) }).strict();

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  try {
    const { incidentId } = await context.params;
    const { vendorId } = await parseJson(request, schema);
    const incident = await getIncidentStore().getIncident(incidentId);
    if (incident === null) throw new PublicRequestError(404, "incident_not_found", "That incident was not found.");
    const { data, error } = await getServiceClient()
      .from("vendor_quotes")
      .select("quote")
      .eq("incident_id", incidentId)
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) throw error;
    if (data === null) throw new PublicRequestError(409, "quote_required", "Record the live vendor quote before paying.");
    const quote = vendorQuoteSchema.parse(data.quote);
    const result = await getProviders().payments.createPayment({
      incident,
      operationId: `op_${randomUUID()}`,
      quote,
      prepaymentEvidenceRefs: quote.evidenceRefs,
    });
    return NextResponse.json(
      { result, verification: result.status === "success" ? "awaiting-signed-webhook" : "not-verified" },
      { status: ["success", "partial"].includes(result.status) ? 200 : 422 },
    );
  } catch (error) {
    return apiError(error);
  }
}
