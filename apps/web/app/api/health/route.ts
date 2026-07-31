import { NextResponse } from "next/server";

import { getServiceClient } from "../../../lib/server/database";

export async function GET() {
  const startedAt = Date.now();
  const { error } = await getServiceClient().from("incidents").select("id", { head: true, count: "exact" }).limit(1);
  return NextResponse.json(
    {
      status: error === null ? "ready" : "degraded",
      checks: { web: "ready", database: error === null ? "ready" : "unavailable" },
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    },
    { status: error === null ? 200 : 503 },
  );
}
