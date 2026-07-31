import { NextResponse } from "next/server";

import { getIncidentStore } from "../../../../../lib/server/database";
import { apiError } from "../../../../../lib/server/http";

export async function GET(_request: Request, context: { params: Promise<{ incidentId: string }> }) {
  try {
    const { incidentId } = await context.params;
    const events = await getIncidentStore().listEvents(incidentId);
    return NextResponse.json({ events });
  } catch (error) {
    return apiError(error);
  }
}
