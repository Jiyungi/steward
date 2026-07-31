import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getIncidentStore } from "../../../../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../../../../lib/server/http";
import { getProviders } from "../../../../../../lib/server/providers";

const schema = z.object({ contactId: z.string().min(1).max(200), idempotencyKey: z.string().min(8).max(200) }).strict();

export async function POST(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  try {
    const { incidentId } = await context.params;
    const input = await parseJson(request, schema);
    const [incident, contact] = await Promise.all([
      getIncidentStore().getIncident(incidentId),
      getIncidentStore().getControlledContact(input.contactId),
    ]);
    if (incident === null) throw new PublicRequestError(404, "incident_not_found", "That incident was not found.");
    if (contact === null) throw new PublicRequestError(404, "contact_not_found", "That controlled contact was not found.");
    const body = `Steward update: your approved demo contact is being used for incident “${incident.goal.slice(0, 180)}”. This confirms message acceptance only; no resolution has been claimed.`;
    const result = await getProviders().a1.sendSms({
      incidentId,
      operationId: `op_${randomUUID()}`,
      idempotencyKey: input.idempotencyKey,
      contact,
      body,
    });
    return NextResponse.json({ result }, { status: result.status === "success" ? 200 : 422 });
  } catch (error) {
    return apiError(error);
  }
}
