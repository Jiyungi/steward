import { NextResponse } from "next/server";
import { z } from "zod";

import { createDemoIncident } from "../../../lib/server/demo";
import { getIncidentStore, getServiceClient } from "../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../lib/server/http";

const createSchema = z
  .object({
    guestSessionId: z.string().trim().min(1).max(200),
    goal: z.string().trim().min(3).max(2_000),
    authorizedMinor: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, createSchema);
    const { data: session, error: sessionError } = await getServiceClient()
      .from("demo_guest_sessions")
      .select("id,expires_at,revoked_at")
      .eq("id", input.guestSessionId)
      .maybeSingle();
    if (sessionError !== null || session === null || session.revoked_at !== null || Date.parse(session.expires_at) <= Date.now()) {
      throw new PublicRequestError(403, "invalid_guest_session", "Start a current demo guest session first.");
    }
    const incident = await createDemoIncident({
      guestSessionId: input.guestSessionId,
      goal: input.goal,
      ...(input.authorizedMinor === undefined ? {} : { authorizedMinor: input.authorizedMinor }),
    });
    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: Request) {
  try {
    const incidentId = new URL(request.url).searchParams.get("id");
    if (incidentId !== null) {
      const incident = await getIncidentStore().getIncident(incidentId);
      if (incident === null) throw new PublicRequestError(404, "incident_not_found", "That incident was not found.");
      return NextResponse.json({ incident });
    }

    const { data, error } = await getServiceClient()
      .from("incidents")
      .select("snapshot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) throw error;
    return NextResponse.json({ incident: data?.snapshot ?? null });
  } catch (error) {
    return apiError(error);
  }
}
