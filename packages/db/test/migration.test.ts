import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260731200000_steward_core.sql",
  import.meta.url,
);

describe("Steward Supabase migration", () => {
  it("creates every operational table and enables service-only RLS", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    const tables = [
      "identities",
      "role_memberships",
      "properties",
      "demo_guest_sessions",
      "controlled_contacts",
      "approved_vendors",
      "incidents",
      "incident_events",
      "provider_operations",
      "evidence_records",
      "vendor_quotes",
      "payments",
      "processed_stripe_events",
    ];
    for (const table of tables) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table public.%I from anon, authenticated");
    expect(sql).toContain("grant all on table public.%I to service_role");
  });

  it("makes evidence-gated closure and Stripe event IDs database-enforced", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toContain("resolve_incident_with_evidence");
    expect(sql).toContain("Incident closure requires evidence");
    expect(sql).toContain("Missing incident evidence");
    expect(sql).toContain("event_id text primary key");
    expect(sql).toContain("idempotency_key text not null unique");
  });
});
