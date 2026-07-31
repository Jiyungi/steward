import { randomUUID } from "node:crypto";

import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerConfig } from "../../../../lib/server/config";
import { getIncidentStore } from "../../../../lib/server/database";
import { apiError, parseJson, PublicRequestError } from "../../../../lib/server/http";

const requestSchema = z
  .object({
    incidentId: z.string().trim().min(1).max(200),
    guestSessionId: z.string().trim().min(1).max(200),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, requestSchema);
    const incident = await getIncidentStore().getIncident(input.incidentId);
    if (incident === null || incident.guestSessionId !== input.guestSessionId) {
      throw new PublicRequestError(403, "incident_access_denied", "This guest session cannot join that incident.");
    }
    const config = getServerConfig();
    const roomName = `incident_${incident.id}`;
    const participantIdentity = `guest_${randomUUID()}`;
    const accessToken = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: "Guest",
      ttl: 600,
      metadata: JSON.stringify({ incidentId: incident.id, guestSessionId: input.guestSessionId, channel: "browser" }),
    });
    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return NextResponse.json({
      serverUrl: config.LIVEKIT_URL,
      roomName,
      participantIdentity,
      token: await accessToken.toJwt(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
