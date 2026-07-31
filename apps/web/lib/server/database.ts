import "server-only";

import { createSupabaseServiceClient, SupabaseIncidentStore } from "@steward/db";

import { getServerConfig } from "./config";

let serviceClient: ReturnType<typeof createSupabaseServiceClient> | undefined;
let incidentStore: SupabaseIncidentStore | undefined;

export function getServiceClient(): ReturnType<typeof createSupabaseServiceClient> {
  const config = getServerConfig();
  serviceClient ??= createSupabaseServiceClient({
    url: config.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: config.SUPABASE_SECRET_KEY,
  });
  return serviceClient;
}

export function getIncidentStore(): SupabaseIncidentStore {
  incidentStore ??= new SupabaseIncidentStore(getServiceClient());
  return incidentStore;
}
