import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { DemoGuestSession, IncidentEvent, IncidentSnapshot } from "@steward/contracts";

import { getServerConfig } from "./config";
import { getIncidentStore, getServiceClient } from "./database";

export const DEMO_OWNER_ID = "owner_demo";
export const DEMO_PROPERTY_ID = "property_demo";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export async function ensureDemoProperty(): Promise<void> {
  const client = getServiceClient();
  const now = new Date().toISOString();
  const { error: ownerError } = await client.from("owners").upsert({
    id: DEMO_OWNER_ID,
    identity_id: null,
    display_name: "Steward demo owner",
    default_currency: "USD",
    updated_at: now,
  });
  if (ownerError !== null) throw new Error(`Demo owner bootstrap failed: ${ownerError.message}`);

  const { error: propertyError } = await client.from("properties").upsert({
    id: DEMO_PROPERTY_ID,
    owner_id: DEMO_OWNER_ID,
    name: "Harbor House",
    address: { label: "Demo property", private: true },
    timezone: "America/Los_Angeles",
    operational_policy: { currency: "USD", authorizedMinor: 25000 },
    updated_at: now,
  });
  if (propertyError !== null) throw new Error(`Demo property bootstrap failed: ${propertyError.message}`);
}

export async function createDemoGuestSession(email: string): Promise<DemoGuestSession> {
  const config = getServerConfig();
  await ensureDemoProperty();
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + config.GUEST_LINK_EXPIRY_DAYS * 86_400_000);
  const session: DemoGuestSession = {
    version: 1,
    id: newId("guest"),
    propertyId: DEMO_PROPERTY_ID,
    emailHash: createHash("sha256").update(email.trim().toLowerCase()).digest("hex"),
    verifiedAt: verifiedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    demo: true,
  };
  const { error } = await getServiceClient().from("demo_guest_sessions").insert({
    id: session.id,
    property_id: session.propertyId,
    email_hash: session.emailHash,
    verified_at: session.verifiedAt,
    expires_at: session.expiresAt,
  });
  if (error !== null) throw new Error(`Demo guest session failed: ${error.message}`);
  return session;
}

export async function createDemoIncident(input: {
  guestSessionId: string;
  goal: string;
  authorizedMinor?: number;
}): Promise<IncidentSnapshot> {
  const now = new Date().toISOString();
  const snapshot: IncidentSnapshot = {
    version: 1,
    id: newId("incident"),
    propertyId: DEMO_PROPERTY_ID,
    bookingId: null,
    guestSessionId: input.guestSessionId,
    goal: input.goal,
    state: "reported",
    risk: "unknown",
    budget: { currency: "USD", authorizedMinor: input.authorizedMinor ?? 25000, spentMinor: 0 },
    activeHypotheses: [],
    pendingOperations: [],
    selectedVendorId: null,
    outcome: null,
    updatedAt: now,
  };
  const createdEvent: IncidentEvent = {
    version: 1,
    incidentId: snapshot.id,
    eventId: newId("event"),
    occurredAt: now,
    actor: { kind: "system", component: "demo" },
    type: "incident.created",
    payload: { snapshot },
  };
  return getIncidentStore().createIncident(snapshot, createdEvent);
}
