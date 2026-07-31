# `@steward/db`

Server-side persistence for Steward incidents. `SupabaseIncidentStore` validates every shared contract before writing, keeps incident events in database sequence order, deduplicates provider operations and Stripe events, prioritizes approved vendors, and refuses incident closure unless every outcome evidence reference exists on that incident.

```ts
import { createSupabaseServiceClient, SupabaseIncidentStore } from "@steward/db";

const store = new SupabaseIncidentStore(createSupabaseServiceClient({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  secretKey: process.env.SUPABASE_SECRET_KEY!,
}));
```

The service client must never be imported into a client component. The migration enables and forces RLS, revokes `anon` and `authenticated` table access, and grants operational access only to `service_role`; application routes must authorize the caller before using this store.

`@steward/db/testing` is intentionally test-only and refuses to initialize outside Vitest/`NODE_ENV=test`.
